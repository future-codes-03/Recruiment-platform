import uuid
from django.db import models


class SoftDeleteManager(models.Manager):
    """Default manager — excludes soft-deleted rows automatically."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class BaseModel(models.Model):
    """
    Abstract base for every tenant-relevant table.
    UUID PK, created/updated timestamps, soft delete.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()  # explicit escape hatch — includes soft-deleted rows

    class Meta:
        abstract = True

    def soft_delete(self):
        from django.utils import timezone
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at'])