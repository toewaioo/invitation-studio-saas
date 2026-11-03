from __future__ import annotations

import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path('/workspace/love-galaxy-preview/final-readable')
ROOT.mkdir(parents=True, exist_ok=True)
URL = os.environ.get('LOVE_GALAXY_PREVIEW_URL', 'http://127.0.0.1:5187/love-galaxy')
CHROMIUM = '/opt/manus/playwright/chromium-1234/chrome-linux64/chrome'
ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--disable-gpu-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']


def state(page):
    return page.locator('canvas.lg-three-canvas').evaluate('c => ({...c.dataset})')


def checkpoint(page, name, threshold, label):
    page.wait_for_function('p => Number(document.querySelector("canvas.lg-three-canvas")?.dataset.cameraProgress) >= p', arg=threshold, timeout=180000)
    before = state(page)
    page.evaluate('() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); }')
    try:
        path = ROOT / f'{label}-{name}.png'
        page.screenshot(path=str(path), full_page=False, timeout=90000)
        return {'checkpoint': name, 'screenshot': str(path), 'camera': before}
    finally:
        page.evaluate('() => { delete document.visibilityState; document.dispatchEvent(new Event("visibilitychange")); }')


def run_size(p, label, width, height):
    print(f'{label}: opening {width}x{height}', flush=True)
    browser = p.chromium.launch(executable_path=CHROMIUM, headless=True, args=ARGS)
    page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1, is_mobile=label == 'phone', has_touch=label == 'phone')
    errors, failures = [], []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.on('response', lambda res: failures.append({'url': res.url, 'status': res.status}) if res.status >= 400 and not res.url.endswith('/favicon.ico') else None)
    response = page.goto(URL, wait_until='networkidle', timeout=30000)
    assert response and response.status == 200
    page.wait_for_function('() => Number(document.querySelector("canvas.lg-three-canvas")?.dataset.loadedDemoTextures) === 4', timeout=30000)
    initial = state(page)
    screenshots = [checkpoint(page, 'photo-band-midpoint', 4 / 11, label)]
    print(f'{label}: crossed band midpoint', flush=True)
    page.wait_for_function('() => Number(document.querySelector("canvas.lg-three-canvas")?.dataset.cameraProgress) >= 6 / 11', timeout=180000)
    exit_state = state(page)
    x, y, z = map(float, exit_state['cameraPose'].split(','))
    assert z >= 13.1 and y < 0, exit_state
    screenshots.append(checkpoint(page, 'above-orbit', 1, label))
    print(f'{label}: reached final above-orbit view', flush=True)
    final = state(page)
    assert float(final['cameraPose'].split(',')[1]) > 22
    assert final['photoInstanceCount'] == '512'
    assert final['loadedDemoTextures'] == '4'
    assert final['curvedTextRingSweep'] == '360'
    assert final['crossedTextRingPlanes'] == 'true'
    assert float(final['textRingRotationOne']) > 0 and float(final['textRingRotationTwo']) < 0
    assert 0 < float(final['textRingFontPixels']) <= (14 if label == 'phone' else 18)
    assert page.locator('body').evaluate('e => e.scrollWidth <= innerWidth && e.scrollHeight <= innerHeight')
    # Memory viewing remains accessible without selecting a private invitation.
    canvas = page.locator('canvas.lg-three-canvas')
    canvas.focus()
    page.keyboard.press('Enter')
    page.get_by_role('dialog', name='Demo memory photo').wait_for(state='visible')
    page.get_by_role('img', name='Demo placeholder: a couple together').wait_for(state='visible')
    page.get_by_role('button', name='Next memory', exact=True).click()
    page.get_by_role('img', name='Demo placeholder: a couple sharing a moment').wait_for(state='visible')
    page.get_by_role('button', name='Close memory', exact=True).click()
    page.get_by_role('dialog', name='Demo memory photo').wait_for(state='hidden')
    canvas.focus()
    page.keyboard.press('ArrowRight')
    page.wait_for_function('() => document.querySelector("canvas.lg-three-canvas")?.dataset.cameraMode === "manual"')
    manual = state(page)
    page.emulate_media(reduced_motion='reduce')
    page.reload(wait_until='networkidle')
    page.wait_for_function('() => document.querySelector("canvas.lg-three-canvas")?.dataset.animationPaused === "true"', timeout=30000)
    reduced = state(page)
    assert reduced['cameraMode'] == 'reduced-motion'
    assert reduced['cameraProgress'] == '0.000'
    assert reduced['activeShootingStars'] == '0'
    assert not errors, errors
    assert not failures, failures
    result = {'viewport': {'width': width, 'height': height, 'deviceScaleFactor': 1}, 'status': response.status, 'initial': initial, 'bandExit': exit_state, 'screenshots': screenshots, 'final': final, 'manualCamera': manual, 'reducedMotion': reduced, 'pageErrors': errors, 'failedResponses': failures, 'modalNavigation': 'passed', 'noOverflow': True}
    (ROOT / f'{label}-qa.json').write_text(json.dumps(result, indent=2) + '\n')
    browser.close()
    return result


with sync_playwright() as p:
    result = {'url': URL, 'desktop': run_size(p, 'desktop', 1024, 768), 'phone': run_size(p, 'phone', 390, 844)}
    (ROOT / 'qa-results.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'result': 'passed', 'viewports': ['1024x768', '390x844'], 'output': str(ROOT / 'qa-results.json')}, indent=2), flush=True)
