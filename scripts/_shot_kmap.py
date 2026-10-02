from playwright.sync_api import sync_playwright

BASE = 'http://localhost:3000'

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={'width': 1440, 'height': 900})
    page.goto(BASE, wait_until='networkidle')

    # Login via UI form
    try:
        page.fill('input[name="emailOrUsername"], input[name="email"], input[type="email"], input[type="text"]', 'admin')
        page.wait_for_timeout(300)
    except Exception as e:
        print('LOGIN input fill err', e)
    # fill password inputs
    pw = page.locator('input[type="password"]')
    if pw.count() > 0:
        pw.first.fill('123')
    btns = page.locator('button')
    for btxt in ['登录', '登 录', 'Sign in', 'login']:
        target = page.locator(f'button:has-text("{btxt}")')
        if target.count() > 0:
            target.first.click()
            break
    page.wait_for_timeout(2500)
    print('URL after login:', page.url)

    # go to knowledge map
    page.goto(BASE + '/sky/learning/graph', wait_until='networkidle')
    page.wait_for_timeout(2500)
    print('Graph URL:', page.url)

    # canvas present?
    canvas = page.locator('canvas').first
    print('canvas count:', page.locator('canvas').count())
    bb = canvas.bounding_box()
    print('canvas bbox:', bb)

    # click zoom in / out to verify controls exist
    z_in = page.locator('button[title="放大 (+)"], button:has-text("+")')
    print('zoom+ count:', z_in.count())
    if z_in.count() > 0:
        page.screenshot(path='/_tmp_kmap_before.png')
        z_in.first.click()
        page.wait_for_timeout(600)
        page.screenshot(path='/_tmp_kmap_after_zoomin.png')

    content = page.content()
    print('has 滚轮缩放 hint:', '滚轮缩放' in content)
    print('has zoom pct:', '100%' in content or '%' in content)
    page.screenshot(path='/_tmp_kmap_full.png', full_page=True)
    b.close()
print('done')