from django.db import migrations, models
from django.db.models.functions import Lower
from django.utils.text import slugify

# The seeded catalog. `slug` is the stable key — change a `name` freely,
# never a `slug`. Adding a skill later means appending to a NEW migration,
# not editing this tuple (this one has already run everywhere).
STARTER_SKILLS = [
    ('backend', 'Backend'),
    ('frontend', 'Frontend'),
    ('full-stack', 'Full-Stack'),
    ('devops', 'DevOps'),
    ('mobile', 'Mobile'),
    ('data-ml', 'Data/ML'),
    ('qa-testing', 'QA / Testing'),
    ('ui-ux-design', 'UI/UX Design'),
]


def backfill_slugs(apps, schema_editor):
    """Give every pre-existing row a slug before `slug` goes unique+NOT NULL.

    These are the ad-hoc rows the old free-text profile write created via
    get_or_create (e.g. "Python", "react"). slugify() can collide where the
    CI-unique `name` did not ("C++" and "C#" both slugify to ""), so fall
    back to a numeric suffix.
    """
    Skill = apps.get_model('jobs', 'Skill')
    taken = set()
    for skill in Skill.objects.all().order_by('created_at'):
        base = slugify(skill.name) or 'skill'
        candidate = base
        suffix = 2
        while candidate in taken:
            candidate = f'{base}-{suffix}'
            suffix += 1
        taken.add(candidate)
        skill.slug = candidate
        skill.save(update_fields=['slug'])


def seed_catalog(apps, schema_editor):
    """Insert the starter catalog idempotently.

    Matches on slug first, then on a case-insensitive name, so a dev
    database that already grew a "Backend" row from the old free-text write
    is adopted into the catalog rather than colliding with uq_skill_name_ci.
    """
    Skill = apps.get_model('jobs', 'Skill')
    for slug, name in STARTER_SKILLS:
        existing = (
            Skill.objects.filter(slug=slug).first()
            or Skill.objects.annotate(lname=Lower('name')).filter(lname=name.lower()).first()
        )
        if existing is None:
            Skill.objects.create(slug=slug, name=name)
            continue
        # An adopted row takes the catalog's spelling for BOTH fields: this
        # tuple is the canonical definition, so a row that drifted in as
        # "Full-stack" becomes "Full-Stack". Safe because the ids the FKs
        # point at are untouched.
        if (existing.slug, existing.name) != (slug, name):
            existing.slug = slug
            existing.name = name
            existing.save(update_fields=['slug', 'name'])


def unseed_catalog(apps, schema_editor):
    """Deliberate no-op.

    JobSkillRequirement.skill is on_delete=PROTECT and candidates hold M2M
    rows against these, so deleting catalog rows on reverse would either
    fail loudly or orphan a candidate's saved skills. Rolling this migration
    back drops the `slug` column; the rows themselves stay.
    """


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0003_alter_job_guaranteed_slots_alter_job_seniority_and_more'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='skill',
            options={'ordering': ['name']},
        ),
        # Three-step add: nullable column -> backfill -> tighten to
        # unique+NOT NULL. A single unique NOT NULL AddField would fail on
        # any database that already has Skill rows.
        # db_index=False on the intermediate field is load-bearing, not
        # incidental: SlugField indexes by default, and on Postgres that
        # creates a companion "<table>_<col>_<hash>_like" index. The
        # AlterField below wants to create a _like index under that exact
        # same name for the unique variant, and the migration dies with
        # 'relation "skills_slug_..._like" already exists'. Skipping the
        # index here lets AlterField create both cleanly.
        migrations.AddField(
            model_name='skill',
            name='slug',
            field=models.SlugField(max_length=100, null=True, db_index=False),
        ),
        migrations.RunPython(backfill_slugs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='skill',
            name='slug',
            field=models.SlugField(max_length=100, unique=True),
        ),
        migrations.RunPython(seed_catalog, unseed_catalog),
    ]
