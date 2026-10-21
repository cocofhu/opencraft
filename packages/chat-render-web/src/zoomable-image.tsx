import { useEffect, useRef, useState, type ImgHTMLAttributes, type PointerEvent } from "react";
import "./zoomable-image.scss";

type Point = { x: number; y: number };
type Transform = Point & { scale: number };
type ImageProps = Pick<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "title" | "onError" | "onLoad"> & { readonly fitToContainer?: boolean };
const fitted: Transform = { x: 0, y: 0, scale: 1 };

/** Transient image manipulation; the surrounding preview retains navigation and focus. */
export function ZoomableImage(props: ImageProps) {
  return <ImageViewport key={props.src} {...props} />;
}

function ImageViewport({ fitToContainer = false, ...props }: ImageProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const current = useRef(fitted);
  const gesture = useRef<{ center: Point; distance: number; transform: Transform } | null>(null);
  const [transform, setTransform] = useState(fitted);
  const [viewportHeight, setViewportHeight] = useState(0);

  const measure = () => {
    const points = [...pointers.current.values()].slice(0, 2);
    const first = points[0];
    if (!first) return null;
    const second = points[1];
    const box = viewport.current!.getBoundingClientRect();
    return {
      center: {
        x: (first.x + (second?.x ?? first.x)) / 2 - box.left - box.width / 2,
        y: (first.y + (second?.y ?? first.y)) / 2 - box.top - box.height / 2,
      },
      distance: second ? Math.hypot(second.x - first.x, second.y - first.y) : 0,
    };
  };
  const rebase = () => {
    const measured = measure();
    gesture.current = measured ? { ...measured, transform: current.current } : null;
  };
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setViewportHeight(viewport.current!.clientHeight);
      pointers.current.clear();
      gesture.current = null;
      current.current = fitted;
      setTransform(fitted);
    });
    observer.observe(viewport.current!);
    return () => observer.disconnect();
  }, []);

  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    event.stopPropagation();
    rebase();
  };
  return <div className="opencraft-zoomable-image" ref={viewport} data-zoomed={transform.scale > 1 || undefined}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.stopPropagation();
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      event.currentTarget.setPointerCapture(event.pointerId);
      rebase();
    }}
    onPointerMove={event => {
      if (!pointers.current.has(event.pointerId)) return;
      event.stopPropagation();
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const start = gesture.current;
      const next = measure();
      if (!start || !next || !image.current || !viewport.current) return;
      const scale = Math.min(5, Math.max(1, start.distance > 0
        ? start.transform.scale * next.distance / start.distance : start.transform.scale));
      const ratio = scale / start.transform.scale;
      const limitX = Math.max(0, (image.current.offsetWidth * scale - viewport.current.clientWidth) / 2);
      const limitY = Math.max(0, (image.current.offsetHeight * scale - viewport.current.clientHeight) / 2);
      const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
      current.current = {
        scale,
        x: clamp(next.center.x - (start.center.x - start.transform.x) * ratio, limitX),
        y: clamp(next.center.y - (start.center.y - start.transform.y) * ratio, limitY),
      };
      setTransform(current.current);
    }}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
    <img {...props} draggable={false} ref={image}
      style={{
        maxHeight: fitToContainer && viewportHeight > 0 ? viewportHeight : undefined,
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
      }} />
  </div>;
}
