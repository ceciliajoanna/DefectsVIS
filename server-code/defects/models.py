from __future__ import unicode_literals

from django.db import models
from datetime import datetime

# Used for representing individuals.
# It represents three types of individuals: reporters, assignees and fixed_by.
class Person(models.Model):
    username = models.CharField(max_length=50,primary_key=True)
    real_name = models.CharField(max_length=100)

    def __str__( self ):
        return self.real_name



# (bug_id,product,component,assignee,assignee_real_name,status,resolution,summary,changed,severity,depends_on,blocks,number_comments,reporter,reporter_real_name,os) in reader:


# Represents a defect
class Defect(models.Model):
    bug_id = models.IntegerField(primary_key=True)
    component = models.CharField(max_length=30)
    assignee = models.ForeignKey(Person,related_name="assignee")
    status = models.CharField(max_length=30)
    resolution = models.CharField(max_length=30)
    summary = models.TextField()
    changed = models.CharField(max_length=30)
    severity = models.CharField(max_length=30)
    depends = models.ManyToManyField("Defect",related_name="depends_on",blank=True, default = None)
    blocks = models.ManyToManyField("Defect",related_name="blockers",blank=True, default = None)
    number_comments = models.IntegerField()
    reporter = models.ForeignKey(Person,related_name="reporter")
    os = models.CharField(max_length=30)
    open_date = models.CharField(max_length=30)
    closed_date = models.CharField(max_length=30)
    fixed_by = models.CharField(max_length=100)

    def __str__( self ):
        return 'BUG #{0}:  {1}'.format(self.bug_id, self.summary)

    def time_to_fix(self):
        try:
            report_date = datetime.strptime(self.open_date.split()[0],'%Y-%m-%d')
            fix_date = datetime.strptime(self.closed_date.split()[0],'%Y-%m-%d')
            return (fix_date - report_date).days
        except:
            return None
    time_to_fix.admin_order_field = 'time_to_fix'
    time_to_fix.short_description = 'Time To Fix'