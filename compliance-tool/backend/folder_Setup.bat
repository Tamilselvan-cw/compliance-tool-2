@echo off
REM FastAPI Project Folder and File Setup

REM Root files
echo. > README.md
echo. > .env.example
echo. > compose.yaml
echo. > pyproject.toml
echo. > alembic.ini

REM Docker folder and files
mkdir docker
echo. > docker\Dockerfile
echo. > docker\Dockerfile.dev
echo. > docker\gunicorn_conf.py
echo. > docker\nginx.dev.conf

REM Migrations folder and files
mkdir migrations
echo. > migrations\env.py
mkdir migrations\versions

REM App folder and subfolders
mkdir app
echo. > app\main.py

REM Config
mkdir app\config
echo. > app\config\settings.py

REM Core
mkdir app\core
echo. > app\core\security.py
echo. > app\core\middleware.py
echo. > app\core\logging.py
echo. > app\core\exceptions.py
echo. > app\core\pagination.py

REM DB
mkdir app\db
echo. > app\db\base.py
echo. > app\db\session.py
echo. > app\db\init_db.py

REM Deps
mkdir app\deps
echo. > app\deps\deps.py

REM Utils
mkdir app\utils
echo. > app\utils\emails.py
echo. > app\utils\fcm.py
echo. > app\utils\device_info.py

REM Modules
mkdir app\modules
REM Auth module
mkdir app\modules\auth
echo. > app\modules\auth\router.py
echo. > app\modules\auth\schemas.py

REM Users module
mkdir app\modules\users
echo. > app\modules\users\models.py
echo. > app\modules\users\schemas.py
echo. > app\modules\users\repo.py
echo. > app\modules\users\router.py
mkdir app\modules\users\service
echo. > app\modules\users\service\get_user.py

REM Organizations module
mkdir app\modules\organizations
echo. > app\modules\organizations\models.py
echo. > app\modules\organizations\schemas.py
echo. > app\modules\organizations\repo.py
echo. > app\modules\organizations\router.py

REM Notifications module
mkdir app\modules\notifications
echo. > app\modules\notifications\models.py
echo. > app\modules\notifications\schemas.py
echo. > app\modules\notifications\repo.py
echo. > app\modules\notifications\router.py

REM Audit module
mkdir app\modules\audit
echo. > app\modules\audit\models.py
echo. > app\modules\audit\repo.py
echo. > app\modules\audit\router.py

REM Templates
mkdir app\templates
mkdir app\templates\email
echo. > app\templates\email\welcome.html.j2
echo. > app\templates\email\invite.html.j2
echo. > app\templates\email\magic_link.html.j2

REM Done
echo.
echo =========== Basic FastAPI project folders and files created! ===========
echo Please edit files as needed for your application.
echo.
pause
