from django.views.generic import TemplateView
from django.db.models import Count
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from . import models
from django.db import connection
import colorsys


# Templates here.
ROOT_FOLDER = "defects/"
HOME_VIEW = ROOT_FOLDER + "index.html"
DEPENDENCIES_VIEW = ROOT_FOLDER + "dependencies.html"
DEFECTS_LIST_VIEW = ROOT_FOLDER + "defects_list.html"
DEVELOPERS_VIEW = ROOT_FOLDER + "developers.html"
TIME_TO_FIX_VIEW = ROOT_FOLDER + "timetofix.html"

def dictfetchall(cursor):
    "Return all rows from a cursor as a dict"
    columns = [col[0] for col in cursor.description]
    return [
        dict(zip(columns, row))
        for row in cursor.fetchall()
    ]




def getBlockingDefects():
    results = []
    with connection.cursor() as cursor:
        cursor.execute("SELECT from_defect_id, (select component from defects_defect AS d where d.bug_id=from_defect_id) as from_component, to_defect_id,  (select component from defects_defect AS d where d.bug_id=to_defect_id) as to_component FROM defects_defect_blocks;")
        results = dictfetchall(cursor)

    return results


def getDefects():
    with connection.cursor() as cursor:
        cursor.execute("SELECT resolution, substr(changed,0,5) AS year, COUNT(*) FROM defects_defect WHERE resolution <> ' ---' GROUP by year,resolution ORDER by year;")
        results = cursor.fetchall()

        years = dict()
        all_components = set()

        for r in results:
            component,year,total = r[0],r[1],r[2]
            if year not in years:
                years[year] = {}

            years[year][component] = total
            all_components.add(component)


        results = []
        for year in sorted(years):
            dict_year = {"year":year}
            components = years[year]
            components.update(dict_year)
            for c in all_components:
                if c not in components:
                    components[c] = 0
            results.append(components)

        return results


def getAvgTTF():
    with connection.cursor() as cursor:
        cursor.execute("select AVG(julianday(SUBSTR(closed_date,0,11))- julianday(SUBSTR(open_date,0,11))) AS ttf_days FROM defects_defect;")
        results = cursor.fetchone()
        return int(results[0])
    return ""


def getDevelopers():
    results = []
    with connection.cursor() as cursor:
        # cursor.execute("select component || '=' || fixed_by AS id, COUNT(*) AS value from defects_defect where fixed_by != ''  group by id HAVING value > 1 order by value DESC;")
        cursor.execute("select my_id as id, total*1.0/comp_total as value FROM (select component || '=' || fixed_by AS my_id, COUNT(*)  AS total, (select count(*) from defects_defect as D where D.component = T.component) AS comp_total from defects_defect AS T where fixed_by != ''  group by my_id HAVING total > 1 order by total DESC) AS U")
        results = dictfetchall(cursor)

    return results

####################
### VIEW CLASSES ###
####################
class DefectsHomeIndex(TemplateView):
    template_name = HOME_VIEW

    def get_context_data(self, **kwargs):
        context = super(DefectsHomeIndex, self).get_context_data(**kwargs)
        context['components'] = models.Defect.objects.all().values('component').annotate(total=Count('component')).order_by('total')
        context['total_defects'] = models.Defect.objects.count()
        context['total_blocking_defects'] = models.Defect.objects.exclude(blocks__isnull=True).count()
        context['total_maintainers'] = models.Defect.objects.values('fixed_by').distinct().count()
        context['defects_trend'] = getDefects()
        context['avg_ttf'] = getAvgTTF()
        return context



class DefectsList(TemplateView):
    template_name = DEFECTS_LIST_VIEW
    def get_context_data(self, **kwargs):
        context = super(DefectsList, self).get_context_data(**kwargs)
        defects_list = models.Defect.objects.all()
        paginator = Paginator(defects_list, 25) # Show 25 defects per page

        page = self.request.GET.get('page')
        try:
            defects = paginator.page(page)
        except PageNotAnInteger:
            # If page is not an integer, deliver first page.
            defects = paginator.page(1)
        except EmptyPage:
            # If page is out of range (e.g. 9999), deliver last page of results.
            defects = paginator.page(paginator.num_pages)
        context["defects"]=defects
        return context


def get_spaced_colors(n):
    max_value = 16581375 #255**3
    interval = int(max_value / n)
    colors = [hex(I)[2:].zfill(6) for I in range(0, max_value, interval)]
    return [(int(i[:2], 16), int(i[2:4], 16), int(i[4:], 16)) for i in colors]

def getColors(N):
    HSV_tuples = [(x*1.0/N, 0.5, 0.5) for x in range(N)]
    RGB_tuples = [ tuple([int(255*y) for y in colorsys.hsv_to_rgb(*x)])  for x in  HSV_tuples]
    return RGB_tuples

# https://www.quora.com/How-do-I-generate-n-visually-distinct-RGB-colours-in-Python
class DependenciesView(TemplateView):
    template_name = DEPENDENCIES_VIEW

    def get_context_data(self, **kwargs):
        context = super(DependenciesView, self).get_context_data(**kwargs)
        context['defects'] = getBlockingDefects()
        components = set([ d['from_component'] for d in context['defects']] + [ d['to_component'] for d in context['defects']])
        components = list(components)
        context['components'] = []
        assigned_colors=dict()
        N = len(components)
        colors = get_spaced_colors(N)
        for i in range(0,N):
            assigned_colors[components[i]] = "rgb"+str(colors[i])

            context['components'].append({"component":components[i], "color": assigned_colors[components[i]] })

        all_nodes = set()
        context['nodes'] = []
        for d in context['defects']:
            if d["from_defect_id"] not in all_nodes:
                context['nodes'].append({ "id":d["from_defect_id"], "color": assigned_colors[d["from_component"]], "textColor": "rgb"+ str(tuple([ (255-int(c)) for c in assigned_colors[d["from_component"]].replace(")","").replace("rgb(","").split(",") ])) })
                all_nodes.add(d["from_defect_id"])
            if d["to_defect_id"] not in all_nodes:
                context['nodes'].append({ "id":d["to_defect_id"], "color": assigned_colors[d["to_component"]], "textColor": "rgb"+ str(tuple([ (255-int(c)) for c in assigned_colors[d["to_component"]].replace(")","").replace("rgb(","").split(",") ])) })
                all_nodes.add(d["to_defect_id"])
        return context

class DevelopersView(TemplateView):
    template_name = DEVELOPERS_VIEW
    def get_context_data(self, **kwargs):
        context = super(DevelopersView, self).get_context_data(**kwargs)
        context['developers'] = getDevelopers()
        return context


from . import stats
def getTTFperComponent():
    final_results = []
    with connection.cursor() as cursor:
        cursor.execute("select julianday(SUBSTR(closed_date,0,11))- julianday(SUBSTR(open_date,0,11)) AS ttf_days, component FROM defects_defect where ttf_days IS NOT NULL;")
        results = dictfetchall(cursor)
        ttf = dict()
        for r in results:
            if r["component"] not in ttf:
                ttf[r["component"]] = []
            ttf[r["component"]].append(int(r["ttf_days"]))

        final_results =[ (component,) + stats.quartiles(dataPoints)  for component,dataPoints in ttf.items() ]


    return final_results



class TTFView(TemplateView):
    template_name = TIME_TO_FIX_VIEW
    def get_context_data(self, **kwargs):
        context = super(TTFView, self).get_context_data(**kwargs)
        context['ttf_data'] = getTTFperComponent()
        return context