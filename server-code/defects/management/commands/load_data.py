from django.core.management.base import BaseCommand
import csv
from defects.models import Defect,Person


defects = {}
people = {}
dependency_list = {}
blocking_list = {}


def clean():
    print("Cleaning data")
    Person.objects.all().delete()
    Defect.objects.all().delete()

def save():
    print("Saving assignee's and reporter's data to database")
    for p_id in people:
        people[p_id].save()

    print("Saving defects to database")
    for bug_id in defects:
        defects[bug_id].save()

    print("Saving defect dependencies to database")
    for defect_id, dependencies in dependency_list.items():
        defectObject = defects.get(defect_id,None)
        if defectObject!= None:
            for dependency_id in dependencies:
                if defects.get(dependency_id,None) != None:
                    defectObject.depends.add(defects[dependency_id])

    for defect_id, dependencies in blocking_list.items():
        defectObject = defects.get(defect_id,None)
        if defectObject!= None:
            for dependency_id in dependencies:
                if defects.get(dependency_id,None) != None:
                    defectObject.blocks.add(defects[dependency_id])



def load(csv_file):
    print("Loading data from csv file (",csv_file,")")
    with open(csv_file, 'r', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile, delimiter=',', quotechar='"')
        next(reader, None) # ignores CSV header
        # for row in reader:
        #     print(len(row))
        #     break
        # i = 1
        for (bug_id,component,assignee,assignee_real_name,status,resolution,summary,changed,severity,depends_on,blocks,number_comments,reporter,reporter_real_name,os,open_date) in reader:
            # print("line",i)
            # i+= 1
            # Dependencies
            dependency_list[bug_id] = depends_on.split(",")
            # Blocking
            blocking_list[bug_id] = blocks.split(",")

            # Assignee
            if assignee.strip() not in people:
                people[assignee.strip()] = Person(username=assignee.strip(),real_name=assignee_real_name)
            assigneeObject = people[assignee.strip()]
            # Reporter
            if reporter.strip() not in people:
                people[reporter.strip()] = Person(username=reporter.strip(),real_name=reporter_real_name)
            reporterObject = people[reporter.strip()]

            defectObject = Defect(
                bug_id=bug_id,
                component=component,
                assignee=assigneeObject, # ForeignKey
                status=status,
                resolution=resolution,
                summary=summary,
                changed=changed,
                severity=severity,
                number_comments=number_comments,
                reporter=reporterObject, # ForeignKey
                os=os,
                open_date=open_date)

            defects[bug_id] = defectObject







class Command(BaseCommand):
    #args = '<foo bar ...>'
    # help = 'our help string comes here'
    def add_arguments(self, parser):
        # parser.add_argument('csv_file', nargs='1', type=string)
        parser.add_argument('-f', type=str, help='The CSV file containing the data to be loaded to the database',required=True)

    def handle(self, *args, **options):
        csv_file = options["f"]
        clean()
        load(csv_file)
        save()
