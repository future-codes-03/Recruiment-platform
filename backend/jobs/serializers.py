from rest_framework import serializers

from .models import Job, JobSkillRequirement


class SkillRequirementSerializer(serializers.ModelSerializer):
    skill_name = serializers.CharField(source='skill.name', read_only=True)
    min_score = serializers.DecimalField(max_digits=5, decimal_places=2, coerce_to_string=False, read_only=True)
    weight_pct = serializers.DecimalField(max_digits=5, decimal_places=2, coerce_to_string=False, read_only=True)

    class Meta:
        model = JobSkillRequirement
        fields = ['skill_name', 'min_score', 'weight_pct']
        # Every field above is explicitly declared with read_only=True — do
        # NOT also set read_only_fields = fields (the accounts/serializers.py
        # shortcut): DRF raises an AssertionError when a field name is both
        # explicitly declared and listed in read_only_fields.


class PublicJobSerializer(serializers.ModelSerializer):
    # Same pattern as UserSerializer.company_id in accounts/serializers.py —
    # Django FK fields expose a `<field>_id` attribute automatically, so this
    # needs no explicit `source=`.
    company_id = serializers.UUIDField(read_only=True)
    slots_remaining = serializers.SerializerMethodField()
    overall_min_score = serializers.DecimalField(
        max_digits=5, decimal_places=2, coerce_to_string=False, allow_null=True, read_only=True
    )
    skill_requirements = SkillRequirementSerializer(many=True, read_only=True)

    class Meta:
        model = Job
        fields = [
            'id', 'company_id', 'title', 'description', 'seniority', 'status',
            'guaranteed_slots', 'slots_filled', 'slots_remaining',
            'overall_min_score', 'skill_requirements',
            'published_at', 'closed_at', 'created_at',
        ]
        read_only_fields = [
            'id', 'title', 'description', 'seniority', 'status',
            'guaranteed_slots', 'slots_filled', 'published_at', 'closed_at', 'created_at',
        ]

    def get_slots_remaining(self, obj):
        return obj.guaranteed_slots - obj.slots_filled
