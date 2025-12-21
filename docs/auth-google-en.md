Enable Google Auth Function
===============================

## CREATE APP ##

* https://console.cloud.google.com/projectselector2/auth/overview?organizationId=0&supportedpurview=project
* New Project : Name
* External Users
* Validate

## AUTH Client ##

* Create new OAuth Client
* App: Web App
* Name: xxxxx
* Origine: same http host like config file
* Redirect: same http host like config file + /auth/google/callback/

## Switch app to public ##
