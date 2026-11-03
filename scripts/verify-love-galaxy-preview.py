from __future__ import annotations

import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path("/workspace/love-galaxy-preview/updated")
ROOT.mkdir(parents=True, exist_ok=True)
URL = os.environ.get("LOVE_GALAXY_PREVIEW_URL", "http://127.0.0.1:5175/love-galaxy")
CHROMIUM = "/opt/manus/playwright/chromium-1234/chrome-linux64/chrome"
BROWSER_ARGS = [
    "--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl", "--ignore-gpu-blocklist",
    "--use-angle=swiftshader", "--disable-gpu-sandbox", "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
    "--disable-frame-rate-limit", "--disable-gpu-vsync",
]


def camera_state(page):
    return page.locator("canvas.lg-three-canvas").evaluate("canvas => ({ phase: canvas.dataset.cameraPhase, progress: Number(canvas.dataset.cameraProgress), pose: canvas.dataset.cameraPose, mode: canvas.dataset.cameraMode, loadedPhotos: Number(canvas.dataset.loadedDemoTextures), text: canvas.dataset.textRingRendering, ringOne: canvas.dataset.textRingRotationOne, ringTwo: canvas.dataset.textRingRotationTwo, drawCalls: canvas.dataset.drawCalls, fps: canvas.dataset.renderFps })")


def capture_checkpoint(page, path):
    before = camera_state(page)
    page.evaluate("() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }")
    try:
        page.wait_for_timeout(100)
        page.screenshot(path=str(path), full_page=False, timeout=90000)
        return {"cameraAtCapture": before, "cameraAfterCapture": camera_state(page)}
    finally:
        page.evaluate("() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); }")


def take_size(playwright, label, width, height, dpr):
    browser = playwright.chromium.launch(executable_path=CHROMIUM, headless=True, args=BROWSER_ARGS)
    page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=dpr)
    page_errors = []
    failed_responses = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("response", lambda response: failed_responses.append({"status": response.status, "url": response.url}) if response.status >= 400 and not response.url.endswith("/favicon.ico") else None)
    response = page.goto(URL, wait_until="networkidle", timeout=30000)
    if not response or response.status != 200:
        raise RuntimeError(f"Preview route did not return HTTP 200: {response.status if response else 'no response'}")
    page.wait_for_function("() => { const c = document.querySelector('canvas.lg-three-canvas'); return c?.dataset.cameraPhase && Number(c.dataset.loadedDemoTextures || 0) === 4; }", timeout=30000)
    snapshots = []
    snapshots.append({"checkpoint": "inside-sphere", **capture_checkpoint(page, ROOT / f"{label}-inside-sphere.png")})
    page.wait_for_function("threshold => Number(document.querySelector('canvas.lg-three-canvas')?.dataset.cameraProgress || 0) >= threshold", arg=0.34, timeout=150000)
    snapshots.append({"checkpoint": "photo-band", **capture_checkpoint(page, ROOT / f"{label}-photo-band.png")})
    page.wait_for_function("threshold => Number(document.querySelector('canvas.lg-three-canvas')?.dataset.cameraProgress || 0) >= threshold", arg=0.45, timeout=150000)
    snapshots.append({"checkpoint": "photo-band-midpoint", **capture_checkpoint(page, ROOT / f"{label}-photo-band-midpoint.png")})
    page.wait_for_function("threshold => Number(document.querySelector('canvas.lg-three-canvas')?.dataset.cameraProgress || 0) >= threshold", arg=0.67, timeout=150000)
    snapshots.append({"checkpoint": "rising-above-orbit", "camera": camera_state(page)})
    page.wait_for_function("threshold => Number(document.querySelector('canvas.lg-three-canvas')?.dataset.cameraProgress || 0) >= threshold", arg=0.9, timeout=150000)
    snapshots.append({"checkpoint": "above-orbit", **capture_checkpoint(page, ROOT / f"{label}-above-orbit.png")})
    main_attrs = page.locator("main.lg-experience").evaluate("element => ({ memoryCount: Number(element.dataset.memoryCount), photoBand: element.dataset.photoOrbitShape, textRings: Number(element.dataset.curvedTextRings), cameraStop: element.dataset.cameraStop })")
    result = {"viewport": {"width": width, "height": height, "deviceScaleFactor": dpr}, "httpStatus": response.status, "main": main_attrs, "snapshots": snapshots, "pageErrors": page_errors, "failedNonFaviconResponses": failed_responses}
    browser.close()
    return result


with sync_playwright() as playwright:
    result = {
        "url": URL,
        "desktop": take_size(playwright, "desktop", 1024, 768, 0.5),
        "phone": take_size(playwright, "phone", 390, 844, 0.75),
    }
    (ROOT / "qa-results.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
