from django.db import models
from core.models import BaseModel
# Create your models here.



class Company(BaseModel):
    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=100, blank=True)
    logo_url = models.URLField(max_length=500, blank=True)
    website_url = models.URLField(max_length=500, blank=True)
    is_verified = models.BooleanField(default=False)

    class Meta:
        db_table = 'companies'
        verbose_name_plural = 'companies'

    def __str__(self):
        return self.name
