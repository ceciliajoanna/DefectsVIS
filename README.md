# DefectsVIS
DefectsVIS is a Web Visualization tool for Visualizing Software Defects. It is implemented using python 3.5 and Django 1.10. 


### Version
1.0.0

### Installation

- Install Django in your machine [Follow instructions here](https://docs.djangoproject.com/en/1.11/topics/install/)
- Create a new Django project. For instance:
    - `django-admin startproject mysite`
- Copy the folder `./server-code/defects` to your Django project (e.g. `mysite`)
- Copy the folder `./server-code/static`  to your Django project (e.g. `mysite`)
- At this point your django project folder should look like below:
    - > mysite/
     |---manage.py
     |---defects/
     |---static/
     |---mysite/
- Then add `defects` to the list of `INSTALLED_APPS` in `settings.py`: 
~~~~~~
 INSTALLED_APPS = [
    (...),
    'defects',
]
~~~~~~