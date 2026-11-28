import { ImageResponse } from "next/og";
import type { FreeResult } from "./free-slots";
import { formatTime } from "./time";

const W = 1080;
const H = 1350;

type ArtSalon = { name: string; slug: string; logo_url: string | null; cover_url?: string | null };

/** Monta a arte (PNG 1080x1350) com os horários livres de um dia. */
export function freeArt({
  salon,
  list,
  day,
  host,
  tz,
}: {
  salon: ArtSalon;
  list: FreeResult[];
  day: string;
  host: string;
  tz: string;
}) {
  const single = list.length === 1 ? list[0] : null;
  const dayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
  const times = (iso: string[]) => iso.map((x) => formatTime(x, tz));
  const chip = (t: string, big: boolean) => (
    <div
      key={t}
      style={{
        display: "flex",
        padding: big ? "14px 26px" : "8px 16px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.14)",
        border: "2px solid rgba(255,255,255,0.35)",
        color: "white",
        fontSize: big ? 40 : 28,
        fontWeight: 700,
      }}
    >
      {t}
    </div>
  );

  return new ImageResponse(
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        padding: 70,
        color: "white",
        fontFamily: "sans-serif",
        background: "linear-gradient(150deg, #1e1033 0%, #6b1a6e 45%, #e0405e 80%, #fb923c 100%)",
        position: "relative",
      }}
    >
      {salon.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={salon.cover_url}
          alt=""
          width={W}
          height={H}
          style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover", opacity: 0.22 }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        {salon.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={salon.logo_url}
            alt=""
            width={130}
            height={130}
            style={{ borderRadius: 32, objectFit: "cover", border: "4px solid rgba(255,255,255,0.6)" }}
          />
        ) : (
          <div
            style={{
              width: 130,
              height: 130,
              borderRadius: 32,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 70,
              fontWeight: 800,
            }}
          >
            {salon.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, letterSpacing: 6, textTransform: "uppercase", opacity: 0.85 }}>{salon.name}</div>
          <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.05 }}>Horários livres</div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 40,
          alignSelf: "flex-start",
          padding: "14px 30px",
          borderRadius: 999,
          background: "white",
          color: "#6b1a6e",
          fontSize: 38,
          fontWeight: 800,
        }}
      >
        {dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 34, marginTop: 50, flex: 1 }}>
        {list.length === 0 && (
          <div style={{ display: "flex", fontSize: 44, opacity: 0.9 }}>
            Agenda cheia neste dia. Chama para outro dia!
          </div>
        )}
        {single ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              {single.pro.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={single.pro.photo_url}
                  alt=""
                  width={96}
                  height={96}
                  style={{ borderRadius: 999, objectFit: "cover", border: "3px solid white" }}
                />
              )}
              <div style={{ display: "flex", fontSize: 50, fontWeight: 700 }}>{`com ${single.pro.name}`}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
              {times(single.byDay.get(day)!.slice(0, 28)).map((t) => chip(t, true))}
            </div>
          </div>
        ) : (
          list.slice(0, 5).map((x) => (
            <div key={x.pro.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 40, fontWeight: 700 }}>{x.pro.name}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {times(x.byDay.get(day)!.slice(0, 14)).map((t) => chip(t, false))}
              </div>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "28px 30px",
          borderRadius: 36,
          background: "rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 800 }}>Agende pelo link</div>
        <div style={{ fontSize: 36, opacity: 0.9, marginTop: 6 }}>{`${host}/${salon.slug}`}</div>
      </div>
    </div>,
    { width: W, height: H },
  );
}
