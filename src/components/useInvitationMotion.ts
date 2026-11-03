import { useEffect, type RefObject } from "react";
import type { Photo } from "../types";
import { pageTurnEase } from "./pageTurnMotion";

type MotionRoot = HTMLElement & { __invitationMotion?: true };
type AnyEl = HTMLElement & { inert?: boolean };
type TurnStrip = { el: HTMLElement; front: HTMLElement; shade: HTMLElement; width: number };
type Turn = {
  direction: 1 | -1;
  tilt: number;
  clone: HTMLElement;
  strips: TurnStrip[];
  progress: number;
  outgoing?: HTMLElement;
  incoming?: HTMLElement;
  target?: number;
};

const myDigits = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "၀၁၂၃၄၅၆၇၈၉"[Number(d)]);
const q = <T extends Element>(root: ParentNode, selector: string) =>
  root.querySelector<T>(selector);
const qa = <T extends Element>(root: ParentNode, selector: string) =>
  Array.from(root.querySelectorAll<T>(selector));
const wait = (ms: number, reduced: boolean, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted || reduced || ms === 0) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

export default function useInvitationMotion(
  root: RefObject<HTMLElement | null>,
  photos: Photo[],
  eventDate: string,
  eventTime: string,
  downloadCalendar: () => void,
): void {
  useEffect(() => {
    const host = root.current as MotionRoot | null;
    if (!host) return;
    const controller = new AbortController();
    const { signal } = controller;
    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let suppressSealClick = false;
    let opened = false,
      busy = false,
      current = 0,
      galleryIndex = 0,
      galleryOpener: HTMLElement | null = null;
    let gesture:
      (Turn & { x: number; y: number; id: number; started: boolean }) | null =
      null;
    let sealGesture: {
      x: number;
      y: number;
      id: number;
      distance: number;
    } | null = null;
    let galleryTouch: { x: number; y: number; id: number } | null = null;
    let popupFrame = 0,
      depthFrame = 0,
      resizeFrame = 0,
      toastTimer = 0;
    const rafs = new Set<number>();
    const timers = new Set<number>();
    const animations = new Set<Animation>();
    const preparationTimers = new Set<number>();
    const preparedTurns = new Map<number, { paper: HTMLElement; mesh: ReturnType<typeof dragClone>; scrollTop: number }>();
    let preparationVersion = 0;
    const timeout = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!signal.aborted) fn();
      }, ms);
      timers.add(id);
      return id;
    };
    const rootEl = () => root.current as MotionRoot | null;
    const el = <T extends Element>(selector: string) => {
      const r = rootEl();
      return r ? q<T>(r, selector) : null;
    };
    const all = <T extends Element>(selector: string) => {
      const r = rootEl();
      return r ? qa<T>(r, selector) : [];
    };
    const pages = () => all<HTMLElement>("#right-leaves > .paper[data-page]");
    const title = (i: number) =>
      pages()[i]?.getAttribute("aria-label") ||
      [
        "မေတ္တာပန်းမုခ်ဦး",
        "ဖိတ်ကြားလွှာ",
        "မင်္ဂလာပြက္ခဒိန်",
        "မင်္ဂလာနေ့ရက်လေး",
        "နေရာလမ်းညွှန်",
        "အမှတ်တရပုံများ",
      ][i] ||
      "";
    const dialogue = () => el<HTMLDialogElement>("#photo-dialog");
    const isExternalModal = () =>
      Array.from(document.querySelectorAll("dialog[open]")).some(
        (d) => d !== dialogue() && !host.contains(d) && !d.contains(host),
      );
    const toast = (text: string) => {
      const node = el<HTMLElement>("#toast");
      if (!node) return;
      node.textContent = text;
      node.classList.add("visible");
      window.clearTimeout(toastTimer);
      toastTimer = timeout(() => node.classList.remove("visible"), 4500);
    };
    const resetParallax = () => {
      const layer = el<HTMLElement>(".keepsake-depth");
      if (!layer) return;
      if (depthFrame) cancelAnimationFrame(depthFrame);
      depthFrame = 0;
      layer.style.setProperty("--depth-x", "0deg");
      layer.style.setProperty("--depth-y", "0deg");
      layer.style.setProperty("--light-x", "50%");
      layer.style.setProperty("--light-y", "40%");
    };
    const updateControls = () => {
      const ps = pages(),
        p = ps[current];
      if (!p) return;
      const map = q<HTMLIFrameElement>(p, "iframe[data-map-src]");
      if (map && !map.src) map.src = map.dataset.mapSrc || "";
      const prev = el<HTMLButtonElement>("#prev-page"),
        next = el<HTMLButtonElement>("#next-page");
      if (prev) prev.disabled = current === 0;
      if (next) next.disabled = current === ps.length - 1;
      const t = el<HTMLElement>("#page-title"),
        n = el<HTMLElement>("#page-number");
      if (t) t.textContent = title(current);
      if (n)
        n.textContent = `${myDigits(current + 1)} / ${myDigits(ps.length)}`;
    };
    const cleanupAnimation = (a: Animation) => {
      animations.delete(a);
      try {
        a.cancel();
      } catch {
        /* detached */
      }
    };
    const dragClone = (
      paper: HTMLElement,
      direction: 1 | -1,
      attach = true,
    ): Turn["clone"] & { stripData?: TurnStrip[] } => {
      const leaf =
        el<HTMLElement>("#right-leaves") || el<HTMLElement>(".right-leaves");
      const mesh = document.createElement("div");
      mesh.className = "turn-mesh drag-leaf";
      mesh.inert = true;
      mesh.setAttribute("aria-hidden", "true");
      const w = leaf?.clientWidth || paper.clientWidth || 1,
        h = leaf?.clientHeight || paper.clientHeight || 1,
        count = reduced ? 1 : 7;
      const strips: TurnStrip[] = [];
      for (let i = 0; i < count; i += 1) {
        const strip = document.createElement("div");
        strip.className = "paper-strip";
        strip.style.width = `${w / count + 0.6}px`;
        const front = document.createElement("div");
        front.className = "strip-face";
        const clone = paper.cloneNode(true) as HTMLElement;
        clone.hidden = false;
        clone.classList.remove("active");
        clone.classList.add("strip-content");
        clone.removeAttribute("data-page");
        clone.removeAttribute("id");
        qa<HTMLElement>(clone, "[id]").forEach((x) => x.removeAttribute("id"));
        qa<HTMLIFrameElement>(clone, "iframe").forEach((x) => x.remove());
        clone.style.width = `${w}px`;
        clone.style.height = `${h}px`;
        clone.style.left = `${(-i * w) / count}px`;
        clone.style.right = "auto";
        clone.inert = true;
        clone.setAttribute("aria-hidden", "true");
        front.append(clone);
        const shade = document.createElement("div");
        shade.className = "strip-shade";
        front.append(shade);
        const back = document.createElement("div");
        back.className = "strip-back";
        strip.append(front, back);
        mesh.append(strip);
        strips.push({ el: strip, front, shade, width: w / count });
      }
      // Lay out ALL seven strips before exposing the mesh. Otherwise its first
      // painted frame stacks every strip at x=0 (especially on a cold turn).
      renderDrag({ direction, tilt: 0, clone: mesh, strips, progress: 0 }, 0);
      if (attach) {
        (leaf || host).append(mesh);
        const scrollTop = paper.scrollTop;
        strips.forEach((s) => {
          const c = q<HTMLElement>(s.front, ".strip-content");
          if (c) c.scrollTop = scrollTop;
        });
      }
      (mesh as Turn["clone"] & { stripData?: TurnStrip[] }).stripData = strips;
      return mesh as Turn["clone"] & { stripData?: TurnStrip[] };
    };
    const renderDrag = (g: Turn, progress: number) => {
      g.progress = progress;
      const qv = g.direction === 1 ? progress : 1 - progress,
        fold = Math.sin(qv * Math.PI),
        base = -qv * Math.PI,
        bend = reduced ? 0 : fold * 0.8;
      let x = 0,
        z = 0;
      g.strips.forEach((s, i) => {
        const t = g.strips.length === 1 ? 0 : i / (g.strips.length - 1) - 0.5,
          angle = base + bend * t;
        s.el.style.transform = `translate3d(${x}px,0,${z}px) rotateY(${(angle * 180) / Math.PI}deg)`;
        // Opacity shades a composited overlay; brightness filters rerasterize
        // seven copies of photos, SVG filigree and Myanmar text every frame.
        s.shade.style.opacity = String(Math.abs(t) * fold * 0.16);
        x += Math.cos(angle) * s.width;
        z -= Math.sin(angle) * s.width;
      });
      const leaf =
        el<HTMLElement>("#right-leaves") || el<HTMLElement>(".right-leaves");
      g.clone.style.transform = `rotateZ(${g.tilt * fold}deg)`;
      leaf?.style.setProperty("--turn-shadow", String(fold * 0.24));
    };
    const clearPreparedTurns = () => {
      preparationVersion += 1;
      preparationTimers.forEach((id) => {
        window.clearTimeout(id);
        timers.delete(id);
      });
      preparationTimers.clear();
      preparedTurns.forEach(({ mesh }) => mesh.remove());
      preparedTurns.clear();
    };
    const warmTurns = () => {
      clearPreparedTurns();
      if (reduced || !opened || busy || signal.aborted) return;
      const version = preparationVersion;
      // Two bounded, invisible meshes only. Split cloning/layout across quiet
      // tasks, not the first pointermove/click. Resting real pages stay unchanged.
      ([1, -1] as const).forEach((direction, i) => {
        const id = timeout(() => {
          preparationTimers.delete(id);
          if (version !== preparationVersion || busy || !opened) return;
          const ps = pages();
          if (!ps[current + direction]) return;
          const paper = direction === 1 ? ps[current] : ps[current - 1];
          const mesh = dragClone(paper, direction, false);
          mesh.classList.add("turn-prepared");
          (el<HTMLElement>("#right-leaves") || host).append(mesh);
          const scrollTop = paper.scrollTop;
          mesh.stripData?.forEach((s) => {
            const content = q<HTMLElement>(s.front, ".strip-content");
            if (content) content.scrollTop = scrollTop;
          });
          preparedTurns.set(direction, { paper, mesh, scrollTop });
        }, 160 + i * 100);
        preparationTimers.add(id);
      });
    };
    const takeTurn = (paper: HTMLElement, direction: 1 | -1) => {
      const prepared = preparedTurns.get(direction);
      preparedTurns.delete(direction);
      clearPreparedTurns();
      if (!prepared || prepared.paper !== paper) {
        prepared?.mesh.remove();
        return dragClone(paper, direction);
      }
      const mesh = prepared.mesh;
      const scrollTop = paper.scrollTop;
      if (scrollTop !== prepared.scrollTop) mesh.stripData?.forEach((s) => {
        const content = q<HTMLElement>(s.front, ".strip-content");
        if (content) content.scrollTop = scrollTop;
      });
      mesh.classList.remove("turn-prepared");
      return mesh;
    };
    const animateLeaf = async (
      g: Turn,
      from: number,
      to: number,
      ms: number,
      smoothStart = false,
    ) => {
      if (reduced || signal.aborted) {
        renderDrag(g, to);
        return;
      }
      await new Promise<void>((resolve) => {
        // Start on the first delivered frame, not before layout/rasterization.
        // A cold first frame must not skip straight into the middle of a curl.
        let start: number | undefined;
        const frame = (now: number) => {
          if (signal.aborted) {
            resolve();
            return;
          }
          start ??= now;
          const p = Math.min(1, (now - start) / ms),
            eased = pageTurnEase(p, smoothStart);
          renderDrag(g, from + (to - from) * eased);
          if (p < 1) {
            schedule();
          } else resolve();
        };
        const schedule = () => {
          const id = requestAnimationFrame((now) => {
            rafs.delete(id);
            frame(now);
          });
          rafs.add(id);
        };
        schedule();
      });
    };
    const syncPopup = () => {
      const p = el<HTMLElement>(".popup-paper");
      if (!p) return;
      p.classList.remove("popup-raised");
      if (!opened || pages()[current] !== p) return;
      p.classList.add("popup-reset");
      if (reduced) {
        p.classList.remove("popup-reset");
        p.classList.add("popup-raised");
        return;
      }
      timeout(() => {
        p.classList.remove("popup-reset");
        if (opened && pages()[current] === p) p.classList.add("popup-raised");
      }, 32);
    };
    const finishTurn = async (
      g: Turn & {
        outgoing: HTMLElement;
        incoming: HTMLElement;
        target: number;
      },
      cancel = false,
    ) => {
      const commit = !cancel && g.progress > 0.3;
      await animateLeaf(g, g.progress, commit ? 1 : 0, 500);
      g.clone.remove();
      (
        el<HTMLElement>("#right-leaves") || el<HTMLElement>(".right-leaves")
      )?.style.removeProperty("--turn-shadow");
      if (commit) {
        g.outgoing.hidden = true;
        g.outgoing.classList.remove("active");
        g.incoming.hidden = false;
        g.incoming.classList.add("active");
        current = g.target;
        updateControls();
      } else {
        g.outgoing.hidden = false;
        g.incoming.hidden = true;
      }
      host.classList.remove("paper-dragging");
      const leaf =
        el<HTMLElement>("#right-leaves") || el<HTMLElement>(".right-leaves");
      if (leaf) delete leaf.dataset.dragging;
      busy = false;
      syncPopup();
      warmTurns();
    };
    const turnPage = async (target: number) => {
      const ps = pages(),
        dialog = dialogue();
      if (
        busy ||
        !opened ||
        dialog?.open ||
        target < 0 ||
        target >= ps.length ||
        target === current
      )
        return;
      busy = true;
      const outgoing = ps[current],
        incoming = ps[target],
        direction = (target > current ? 1 : -1) as 1 | -1;
      const clone = takeTurn(direction === 1 ? outgoing : incoming, direction);
      const g: Turn = {
        direction,
        tilt: direction * 0.9,
        clone,
        strips:
          (clone as unknown as { stripData?: TurnStrip[] }).stripData || [],
        progress: 0,
      };
      outgoing.hidden = true;
      outgoing.classList.remove("active");
      incoming.hidden = false;
      incoming.scrollTop = 0;
      incoming.classList.add("active");
      current = target;
      updateControls();
      try {
        await animateLeaf(g, 0, 1, 760, true);
      } finally {
        clone.remove();
        busy = false;
        (
          el<HTMLElement>("#right-leaves") || el<HTMLElement>(".right-leaves")
        )?.style.removeProperty("--turn-shadow");
      }
      syncPopup();
      warmTurns();
    };
    const openInvitation = async () => {
      const arrival = el<HTMLElement>("#arrival"),
        book = el<HTMLElement>("#book"),
        openingCover = el<HTMLElement>("#opening-cover"),
        room = el<HTMLElement>("#reading-room");
      if (busy || opened || dialogue()?.open) return;
      const ps = pages();
      if (!arrival || !book || !ps.length) return;
      busy = true;
      ps.forEach((p, i) => {
        p.hidden = i !== 0;
        p.classList.toggle("active", i === 0);
      });
      current = 0;
      syncPopup();
      resetParallax();
      const open = el<HTMLButtonElement>("#open-envelope");
      const photo = el<HTMLButtonElement>("#arrival-photo");
      if (open) open.disabled = true;
      if (photo) photo.disabled = true;
      arrival.setAttribute("aria-busy", "true");
      arrival.classList.add("opening");
      try {
        // Let the wax split before the hinged flap clears the paper.
        await wait(900, reduced, signal);
        if (signal.aborted) return;
        arrival.classList.add("extracting");
        await wait(1100, reduced, signal);
        if (signal.aborted) return;
        arrival.classList.add("presenting");
        await wait(350, reduced, signal);
        if (signal.aborted) return;
        const from = q<HTMLElement>(
          host,
          ".letter-peek",
        )?.getBoundingClientRect();
        arrival.hidden = true;
        host.classList.remove("sealed");
        if (room) room.hidden = false;
        if (el<HTMLElement>("#rewrap"))
          el<HTMLElement>("#rewrap")!.hidden = false;
        if (el<HTMLElement>("#keepsake-photo"))
          el<HTMLElement>("#keepsake-photo")!.hidden = !photos.length;
        if (openingCover) openingCover.hidden = true;
        book.classList.add("unfolded");
        opened = true;
        const to = book.getBoundingClientRect();
        if (!reduced && book.animate && from) {
          const a = book.animate(
            [
              {
                transform: `translate(${from.left + from.width / 2 - to.left - to.width / 2}px,${from.top + from.height / 2 - to.top - to.height / 2}px) scale(${from.width / to.width},${from.height / to.height}) rotate(-3deg)`,
                opacity: 0.85,
              },
              {
                transform: "translate(0,0) scale(1) rotate(-.35deg)",
                opacity: 1,
              },
            ],
            {
              duration: 800,
              easing: "cubic-bezier(.2,.75,.22,1)",
              fill: "both",
            },
          );
          animations.add(a);
          try {
            await a.finished;
          } catch {
            /* canceled */
          }
          cleanupAnimation(a);
        }
      } finally {
        arrival.removeAttribute("aria-busy");
        busy = false;
      }
      syncPopup();
      warmTurns();
      el<HTMLElement>("#next-page")?.focus({ preventScroll: true });
    };
    const rewrap = async () => {
      if (busy) return;
      clearPreparedTurns();
      const book = el<HTMLElement>("#book"),
        arrival = el<HTMLElement>("#arrival");
      if (!book || !arrival) return;
      busy = true;
      try {
        book.classList.remove("unfolded");
        await wait(650, reduced, signal);
        if (signal.aborted) return;
        el<HTMLElement>("#reading-room")?.setAttribute("hidden", "");
        arrival.hidden = false;
        host.classList.add("sealed");
        arrival.classList.remove(
          "opening",
          "departing",
          "extracting",
          "presenting",
        );
        const arrivalPhoto = el<HTMLButtonElement>("#arrival-photo");
        if (arrivalPhoto) arrivalPhoto.disabled = !photos.length;
        el<HTMLElement>("#rewrap")!.hidden = true;
        el<HTMLElement>("#keepsake-photo")!.hidden = true;
        el<HTMLButtonElement>("#open-envelope")?.removeAttribute("disabled");
        opened = false;
      } finally {
        busy = false;
      }
      el<HTMLButtonElement>("#open-envelope")?.focus({ preventScroll: true });
    };
    const renderGallery = () => {
      const image = el<HTMLImageElement>("#large-photo");
      if (!image || !photos.length) return;
      image.getAnimations().forEach((a) => a.cancel());
      const photo = photos[galleryIndex];
      image.src = photo.url;
      image.alt = photo.caption || "Wedding memory";
      if (el<HTMLElement>("#gallery-counter"))
        el<HTMLElement>("#gallery-counter")!.textContent =
          `${myDigits(galleryIndex + 1)} / ${myDigits(photos.length)}`;
      all<HTMLElement>("[data-gallery]").forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(Number(b.dataset.gallery) === galleryIndex),
        ),
      );
      if (!reduced && image.animate)
        image.animate(
          [
            { opacity: 0.25, transform: "scale(.985)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 300, easing: "ease-out" },
        );
    };
    const resetGalleryTouch = () => {
      const stage = el<HTMLElement>("#gallery-stage");
      const id = galleryTouch?.id;
      galleryTouch = null;
      if (id !== undefined && stage?.hasPointerCapture(id)) {
        try {
          stage.releasePointerCapture(id);
        } catch {
          /* already released */
        }
      }
    };
    const openGallery = (index: number, trigger?: HTMLElement) => {
      if (busy || !photos.length) return;
      const dialog = dialogue();
      if (!dialog) return;
      resetGalleryTouch();
      if (!dialog.open)
        galleryOpener =
          trigger || (document.activeElement as HTMLElement | null);
      galleryIndex = Math.max(0, Math.min(photos.length - 1, index));
      renderGallery();
      if (!dialog.open) dialog.showModal();
      resetParallax();
    };
    const nextPhoto = (step: number) => {
      if (!photos.length) return;
      galleryIndex = (galleryIndex + step + photos.length) % photos.length;
      renderGallery();
    };

    const on = (
      target: EventTarget | null,
      type: string,
      listener: EventListener,
      options?: AddEventListenerOptions,
    ) => target?.addEventListener(type, listener, { ...options, signal });
    const openButton = el<HTMLButtonElement>("#open-envelope");
    on(openButton, "click", (event) => {
      if (suppressSealClick) {
        event.preventDefault();
        suppressSealClick = false;
        return;
      }
      void openInvitation();
    });
    on(el<HTMLElement>("#rewrap"), "click", () => {
      void rewrap();
    });
    on(el<HTMLButtonElement>("#prev-page"), "click", () => {
      void turnPage(current - 1);
    });
    on(el<HTMLButtonElement>("#next-page"), "click", () => {
      void turnPage(current + 1);
    });
    const leaf =
      el<HTMLElement>("#right-leaves") || el<HTMLElement>(".right-leaves");
    on(leaf, "pointerdown", ((event: PointerEvent) => {
      if (
        gesture ||
        busy ||
        !opened ||
        event.button > 0 ||
        (event.target as Element)?.closest("input,select,textarea,button,a")
      )
        return;
      gesture = {
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId,
        started: false,
        direction: 1,
        tilt: 0,
        clone: document.createElement("div"),
        strips: [],
        progress: 0,
      };
      try {
        leaf?.setPointerCapture(event.pointerId);
      } catch {
        /* unsupported */
      }
    }) as EventListener);
    on(leaf, "pointermove", ((event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id || !leaf) return;
      const g = gesture,
        dx = event.clientX - g.x,
        dy = event.clientY - g.y;
      if (!g.started) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
        if (Math.abs(dy) > Math.abs(dx) * 0.8) {
          gesture = null;
          return;
        }
        g.direction = dx < 0 ? 1 : -1;
        g.target = current + g.direction;
        const ps = pages();
        if (g.target < 0 || g.target >= ps.length) {
          gesture = null;
          return;
        }
        g.started = true;
        busy = true;
        g.outgoing = ps[current];
        g.incoming = ps[g.target];
        g.clone = takeTurn(g.direction === 1 ? g.outgoing : g.incoming, g.direction);
        g.strips =
          (g.clone as unknown as { stripData?: TurnStrip[] }).stripData || [];
        g.outgoing.hidden = true;
        g.incoming.hidden = false;
        g.incoming.scrollTop = 0;
        g.tilt = Math.max(
          -4,
          Math.min(
            4,
            ((event.clientY - leaf.getBoundingClientRect().top) /
              leaf.clientHeight -
              0.5) *
              6,
          ),
        );
        host.classList.add("paper-dragging");
        leaf.dataset.dragging = "true";
      }
      if (event.cancelable) event.preventDefault();
      const amount =
        g.direction === 1 ? -(event.clientX - g.x) : event.clientX - g.x;
      renderDrag(
        g,
        Math.max(
          0,
          Math.min(0.98, amount / (leaf.getBoundingClientRect().width * 0.9)),
        ),
      );
    }) as EventListener);
    const settleGesture = (cancel = false) => {
      const g = gesture;
      gesture = null;
      if (g?.started)
        void finishTurn(
          g as Turn & {
            outgoing: HTMLElement;
            incoming: HTMLElement;
            target: number;
          },
          cancel,
        );
    };
    on(leaf, "pointerup", () => settleGesture());
    on(leaf, "pointercancel", () => settleGesture(true));
    on(leaf, "lostpointercapture", () => settleGesture(true));
    const scene = el<HTMLElement>(".envelope-scene");
    const depth = el<HTMLElement>(".keepsake-depth");
    on(scene, "pointermove", ((event: PointerEvent) => {
      if (
        reduced ||
        opened ||
        busy ||
        sealGesture ||
        dialogue()?.open ||
        !depth ||
        !scene
      )
        return;
      const r = scene.getBoundingClientRect(),
        x = Math.max(
          -1,
          Math.min(1, ((event.clientX - r.left) / r.width) * 2 - 1),
        ),
        y = Math.max(
          -1,
          Math.min(1, ((event.clientY - r.top) / r.height) * 2 - 1),
        );
      if (depthFrame) cancelAnimationFrame(depthFrame);
      depthFrame = requestAnimationFrame(() => {
        depth.style.setProperty("--depth-x", `${(x * 5).toFixed(2)}deg`);
        depth.style.setProperty("--depth-y", `${(-y * 4).toFixed(2)}deg`);
        depth.style.setProperty("--light-x", `${(50 + x * 35).toFixed(1)}%`);
        depth.style.setProperty("--light-y", `${(40 + y * 30).toFixed(1)}%`);
      });
    }) as EventListener);
    on(scene, "pointerleave", resetParallax);
    on(scene, "pointercancel", resetParallax);
    const seal = openButton,
      arrival = el<HTMLElement>("#arrival");
    on(seal, "pointerdown", ((event: PointerEvent) => {
      if (busy || opened || dialogue()?.open || event.button > 0 || sealGesture)
        return;
      sealGesture = {
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId,
        distance: 0,
      };
      resetParallax();
      try {
        seal?.setPointerCapture(event.pointerId);
      } catch {
        /* unsupported */
      }
    }) as EventListener);
    on(seal, "pointermove", ((event: PointerEvent) => {
      if (
        !sealGesture ||
        event.pointerId !== sealGesture.id ||
        !seal ||
        !arrival
      )
        return;
      const dx = event.clientX - sealGesture.x,
        dy = event.clientY - sealGesture.y;
      sealGesture.distance = Math.hypot(dx, dy);
      if (sealGesture.distance < 6) return;
      event.preventDefault();
      arrival.classList.add("seal-tugging");
      const p = Math.min(1, sealGesture.distance / 64);
      seal.style.setProperty(
        "--seal-x",
        `${Math.max(-38, Math.min(38, dx * 0.65))}px`,
      );
      seal.style.setProperty(
        "--seal-y",
        `${Math.max(-42, Math.min(42, dy * 0.65))}px`,
      );
      seal.style.setProperty("--seal-angle", `${dx * 0.25}deg`);
      arrival.style.setProperty("--seal-peel", String(p));
      arrival.style.setProperty("--peel-angle", `${-p * 46}deg`);
      arrival.style.setProperty("--peel-lift", `${-p * 8}px`);
    }) as EventListener);
    const finishSeal = (cancel = false) => {
      const g = sealGesture;
      if (!g) return;
      sealGesture = null;
      arrival?.classList.remove("seal-tugging");
      ["--seal-x", "--seal-y", "--seal-angle"].forEach((k) =>
        seal?.style.removeProperty(k),
      );
      ["--seal-peel", "--peel-angle", "--peel-lift"].forEach((k) =>
        arrival?.style.removeProperty(k),
      );
      if (g.distance > 6) {
        suppressSealClick = true;
        timeout(() => {
          suppressSealClick = false;
        }, 350);
      }
      if (!cancel && g.distance > 38) void openInvitation();
    };
    on(seal, "pointerup", () => finishSeal());
    on(seal, "pointercancel", () => finishSeal(true));
    on(seal, "lostpointercapture", () => {
      if (sealGesture) finishSeal(true);
    });
    on(el<HTMLElement>("#popup-replay"), "click", () => {
      if (!busy) syncPopup();
    });
    const popupStage = el<HTMLElement>("#popup-stage");
    on(popupStage, "pointermove", ((event: PointerEvent) => {
      if (reduced || busy || dialogue()?.open || !popupStage) return;
      const r = popupStage.getBoundingClientRect(),
        x = Math.max(
          -1,
          Math.min(1, ((event.clientX - r.left) / r.width) * 2 - 1),
        ),
        y = Math.max(
          -1,
          Math.min(1, ((event.clientY - r.top) / r.height) * 2 - 1),
        );
      if (popupFrame) cancelAnimationFrame(popupFrame);
      popupFrame = requestAnimationFrame(() => {
        popupStage.style.setProperty("--arch-y", `${-7 + x * 5}deg`);
        popupStage.style.setProperty("--arch-x", `${8 - y * 3}deg`);
      });
    }) as EventListener);
    on(popupStage, "pointerleave", () => {
      if (popupFrame) cancelAnimationFrame(popupFrame);
      popupStage?.style.removeProperty("--arch-y");
      popupStage?.style.removeProperty("--arch-x");
    });
    on(el<HTMLElement>("#calendar"), "click", () => downloadCalendar());
    on(el<HTMLElement>("#wedding-day"), "click", () => {
      const p = el<HTMLElement>(".calendar-paper");
      if (p) {
        p.classList.remove("celebrate");
        void p.offsetWidth;
        p.classList.add("celebrate");
        timeout(() => p.classList.remove("celebrate"), 1800);
      }
    });
    on(el<HTMLElement>("#venue-jump"), "click", () => {
      const target = pages().findIndex((p) =>
        p.classList.contains("directions-paper"),
      );
      if (target >= 0) void turnPage(target);
    });
    const photoButtons = all<HTMLButtonElement>(
      "[data-photo-index], .album-photo, .arrival-photo, .desktop-photo",
    );
    if (!photos.length)
      photoButtons.forEach((button) => {
        button.disabled = true;
      });
    photoButtons.forEach((button) =>
      on(button, "click", () => {
        if (!photos.length) return;
        const i =
          button.dataset.photoIndex !== undefined
            ? Number(button.dataset.photoIndex)
            : photos.findIndex(
                (p) => q<HTMLImageElement>(button, "img")?.src === p.url,
              );
        if (i >= 0) openGallery(i, button);
      }),
    );
    on(el<HTMLButtonElement>("#share"), "click", async () => {
      const data = {
        title: document.title,
        text: "မေတ္တာဖြင့် ဖိတ်ကြားအပ်ပါသည်။",
        url: location.href,
      };
      try {
        if (navigator.share) await navigator.share(data);
        else {
          await navigator.clipboard?.writeText(location.href);
          toast("ဖိတ်စာ link ကို ကူးယူပြီးပါပြီ။");
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError")
          toast("Browser လိပ်စာဘားမှ ဖိတ်စာ link ကို ကူးယူနိုင်ပါသည်။");
      }
    });
    on(el<HTMLElement>("#gallery-prev"), "click", () => nextPhoto(-1));
    on(el<HTMLElement>("#gallery-next"), "click", () => nextPhoto(1));
    all<HTMLElement>("[data-gallery]").forEach((button) =>
      on(button, "click", () => {
        galleryIndex = Number(button.dataset.gallery) || 0;
        renderGallery();
      }),
    );
    const stage = el<HTMLElement>("#gallery-stage");
    on(stage, "pointerdown", ((event: PointerEvent) => {
      galleryTouch = {
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId,
      };
      try {
        stage?.setPointerCapture(event.pointerId);
      } catch {
        /* unsupported */
      }
    }) as EventListener);
    on(stage, "pointerup", ((event: PointerEvent) => {
      const g = galleryTouch;
      galleryTouch = null;
      if (!g || g.id !== event.pointerId) return;
      const dx = event.clientX - g.x,
        dy = event.clientY - g.y;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5)
        nextPhoto(dx < 0 ? 1 : -1);
    }) as EventListener);
    on(stage, "pointercancel", resetGalleryTouch);
    on(stage, "lostpointercapture", () => {
      galleryTouch = null;
    });
    const dialog = dialogue();
    on(el<HTMLElement>(".close-dialog"), "click", () => {
      resetGalleryTouch();
      dialog?.close();
    });
    on(dialog, "cancel", (event) => {
      event.preventDefault();
      event.stopPropagation();
      resetGalleryTouch();
      dialog?.close();
    });
    on(dialog, "close", () => {
      resetGalleryTouch();
      el<HTMLImageElement>("#large-photo")
        ?.getAnimations()
        .forEach((a) => a.cancel());
      resetParallax();
      const fallback = opened
        ? el<HTMLElement>("#keepsake-photo")
        : el<HTMLElement>("#arrival-photo");
      const returnFocus =
        galleryOpener?.isConnected && !galleryOpener.hasAttribute("disabled")
          ? galleryOpener
          : fallback;
      returnFocus?.focus({ preventScroll: true });
      galleryOpener = null;
    });
    on(host, "keydown", ((event: KeyboardEvent) => {
      if (
        !rootEl()?.isConnected ||
        isExternalModal() ||
        (event.target as Element)?.closest(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      if (dialog?.open) {
        if (event.key === "Escape") {
          event.preventDefault();
          dialog.close();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          nextPhoto(1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          nextPhoto(-1);
        }
        return;
      }
      if (!opened) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        void turnPage(current + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void turnPage(current - 1);
      }
    }) as EventListener);
    on(window, "resize", () => {
      clearPreparedTurns();
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        settleGesture(true);
        resetParallax();
        warmTurns();
      });
    });
    // React StrictMode deliberately mounts effects twice: always restore the sealed baseline.
    host.classList.add("sealed");
    const initialArrival = el<HTMLElement>("#arrival");
    if (initialArrival) {
      initialArrival.hidden = false;
      initialArrival.classList.remove(
        "opening",
        "extracting",
        "presenting",
        "seal-tugging",
      );
      initialArrival.removeAttribute("aria-busy");
    }
    const initialRoom = el<HTMLElement>("#reading-room");
    if (initialRoom) initialRoom.hidden = true;
    const initialSeal = el<HTMLButtonElement>("#open-envelope");
    if (initialSeal) initialSeal.disabled = false;
    const initialPhoto = el<HTMLButtonElement>("#arrival-photo");
    if (initialPhoto) initialPhoto.disabled = !photos.length;
    ["#rewrap", "#keepsake-photo"].forEach((selector) => {
      const control = el<HTMLElement>(selector);
      if (control) control.hidden = true;
    });
    el<HTMLElement>("#book")?.classList.remove("unfolded");
    pages().forEach((paper, i) => {
      paper.hidden = i !== 0;
      paper.classList.toggle("active", i === 0);
    });
    all<HTMLElement>(".calendar-paper .date-cell:not(.date-empty)").forEach(
      (node, i) => node.style.setProperty("--day-index", String(i + 1)),
    );
    updateControls();

    return () => {
      controller.abort();
      clearPreparedTurns();
      timers.forEach((id) => window.clearTimeout(id));
      [popupFrame, depthFrame, resizeFrame, ...Array.from(rafs)].forEach(
        (id) => {
          if (id) cancelAnimationFrame(id);
        },
      );
      animations.forEach((a) => cleanupAnimation(a));
      qa<HTMLElement>(host, ".turn-mesh").forEach((x) => x.remove());
      if (dialog?.open) dialog.close();
      host.classList.remove("sealed", "paper-dragging");
      host.style.removeProperty("--turn-shadow");
      const leafNode =
        el<HTMLElement>("#right-leaves") || el<HTMLElement>(".right-leaves");
      leafNode?.removeAttribute("data-dragging");
      resetParallax();
      host.__invitationMotion = undefined;
    };
  }, [root, photos, eventDate, eventTime, downloadCalendar]);
}
