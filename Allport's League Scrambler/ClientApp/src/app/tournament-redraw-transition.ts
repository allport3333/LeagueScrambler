const duration = 620;
const topInset = 80;

export function moveToRedrawPreview(preview: HTMLElement, heading: HTMLElement, card: HTMLElement,
    origin: DOMRect | undefined, arrived: (animateReveal: boolean) => void): () => void {
    const revealImmediately = () => {
        heading.scrollIntoView({ behavior: 'instant', block: 'start' });
        arrived(false);
    };
    if (!origin || origin.bottom <= 0 || origin.top >= window.innerHeight ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.requestAnimationFrame) {
        revealImmediately();
        return () => {};
    }

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
    card.hidden = false;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const x = (value: number) => clamp(value, 8, window.innerWidth - width - 8);
    const y = (value: number) => clamp(value, 8, window.innerHeight - height - 8);
    const fromX = x(origin.left + (origin.width - width) / 2);
    const fromY = y(origin.top + (origin.height - height) / 2);
    const fromScroll = window.scrollY;
    const destination = heading.getBoundingClientRect();
    const scrollNeeded = destination.top < topInset || destination.bottom > window.innerHeight - height;
    const from = performance.now();
    let frame = 0;
    let highlight: ReturnType<typeof setTimeout> | undefined;

    function stop() {
        window.cancelAnimationFrame(frame);
        window.removeEventListener('wheel', interrupt);
        window.removeEventListener('touchstart', interrupt);
        clearTimeout(highlight);
        card.hidden = true;
        preview.classList.remove('redraw-arrived');
    }

    function interrupt() {
        stop();
        arrived(false);
    }

    function render(now: number) {
        if (!preview.isConnected) { stop(); return; }
        const time = clamp((now - from) / duration, 0, 1);
        const ease = time * time * (3 - 2 * time);
        if (scrollNeeded) {
            const top = window.scrollY + heading.getBoundingClientRect().top - topInset;
            window.scrollTo({ top: fromScroll + (top - fromScroll) * ease, behavior: 'instant' });
        }

        const target = heading.getBoundingClientRect();
        const endX = x(target.left + (target.width - width) / 2);
        const endY = y(target.top + (target.height - height) / 2);
        card.style.transform = `translate3d(${x(fromX + (endX - fromX) * ease)}px, ${y(fromY + (endY - fromY) * ease)}px, 0)`;
        card.style.opacity = String(clamp((1 - time) / .18, 0, 1));

        if (time < 1) { frame = window.requestAnimationFrame(render); return; }
        stop();
        preview.classList.add('redraw-arrived');
        highlight = setTimeout(() => preview.classList.remove('redraw-arrived'), 550);
        arrived(true);
    }

    window.addEventListener('wheel', interrupt, { passive: true });
    window.addEventListener('touchstart', interrupt, { passive: true });
    render(from);
    return stop;
}
