from django.conf.urls import url

from . import views

urlpatterns = [
    url(r'^$', views.DefectsHomeIndex.as_view(), name='defects_home'),
    url(r'^dependencies/', views.DependenciesView.as_view(), name='defects_dependencies'),
    url(r'^list/', views.DefectsList.as_view(), name='defects_list'),
    url(r'^developers/', views.DevelopersView.as_view(), name='defects_developers'),
    url(r'^time/', views.TTFView.as_view(), name='defects_time'),
]