 
import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
from app.config.settings import settings

env = Environment(
    loader=FileSystemLoader(str(Path(__file__).resolve().parent.parent / "templates" / "emails")),
    autoescape=select_autoescape(["html"])
)

def render_template(name: str, **ctx) -> str:
    return env.get_template(name).render(**ctx)

def send_email(to_email: str, subject: str, html: str) -> None:
    msg = MIMEText(html, "html")
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.EMAIL_FROM_NAME, settings.EMAIL_FROM))
    msg["To"] = to_email

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as s:
        s.starttls()
        s.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        s.sendmail(settings.EMAIL_FROM, [to_email], msg.as_string())
