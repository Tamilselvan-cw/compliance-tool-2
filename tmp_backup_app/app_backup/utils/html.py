from starlette.responses import HTMLResponse

def render_confirm_page(title: str, body: str) -> HTMLResponse:
    html = f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>{title}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <style>
      body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#f6f7fb; margin:0; }}
      .card {{ max-width:540px; margin:8vh auto; background:#fff; border-radius:14px; box-shadow:0 10px 24px rgba(0,0,0,.08); padding:24px 28px; }}
      h1 {{ font-size:20px; margin:0 0 8px; }}
      p {{ color:#334155; line-height:1.55; }}
      .ok {{ color:#15803d; font-weight:600; }}
      .warn {{ color:#b45309; font-weight:600; }}
      .err {{ color:#b91c1c; font-weight:600; }}
      .btn {{ display:inline-block; margin-top:14px; padding:10px 14px; border-radius:10px; border:1px solid #e2e8f0; text-decoration:none; }}
      .btn-primary {{ background:#0f172a; color:#fff; border-color:#0f172a; }}
      input[type=email] {{ width:100%; padding:10px 12px; border:1px solid #e2e8f0; border-radius:10px; margin-top:8px; }}
    </style>
  </head>
  <body>
    <div class="card">
      {body}
    </div>
  </body>
</html>"""
    return HTMLResponse(html)
