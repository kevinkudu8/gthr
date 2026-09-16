import Image from "next/image";

type Props = {
  name: string;
  initial: string;
  image: string | null;
};

/**
 * A black-and-white polaroid. The DOM figure provides layout, shadow, and
 * accessibility; the WebGL layer paints the whole card — frame, photo,
 * caption — over it (`data-bend` + `data-frame`, see BendImages.tsx) so the
 * frame bends with the photo on scroll. The DOM frame is made transparent.
 */
export function TeamCard({ name, initial, image }: Props) {
  return (
    <figure
      className={`polaroid w-full max-w-[13rem] ${image ? "polaroid--bent" : ""}`}
      data-bend={image ? "" : undefined}
      data-frame={image ? "" : undefined}
      data-src={image ?? undefined}
      data-gray={image ? "" : undefined}
    >
      <div className="relative aspect-[4/5] overflow-hidden" data-photo-well>
        {image ? (
          <Image
            src={image}
            alt={`${name}, GTHR`}
            fill
            sizes="(min-width: 64rem) 13rem, 40vw"
            className="bend-source object-cover"
          />
        ) : (
          <span className="display absolute inset-0 grid place-items-center bg-paper-elevated text-[6rem] text-ink-4">
            {initial}
          </span>
        )}
      </div>
      <figcaption className="polaroid__caption font-mono text-[10px] text-ink-2">
        <span>{name}</span>
        <span className="text-ink-3">{initial}</span>
      </figcaption>
    </figure>
  );
}
