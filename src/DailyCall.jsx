import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Create a room via backend
async function createRoom() {
  const resp = await fetch("/api/create-room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expMinutes: 120, privacy: "public" }),
  });
  if (!resp.ok) throw new Error("Failed to create room");
  const { room } = await resp.json();
  return room;
}

export default function DailyCall({ domain }) {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);

  // Picture-in-Picture management
  const pipWindowRef = useRef(null);
  const [pipOpen, setPipOpen] = useState(false);
  const [autoPin, setAutoPin] = useState(true);

  const prebuiltUrl = useMemo(() => {
    if (!domain || !room) return "";
    return `https://${domain}/${room.name}`;
  }, [domain, room]);

  const startCall = useCallback(async () => {
    try {
      setLoading(true);
      const created = await createRoom();
      setRoom(created);
    } catch (e) {
      console.error(e);
      alert("Error creating room. Check backend logs.");
    } finally {
      setLoading(false);
    }
  }, []);

  const copyLink = useCallback(async () => {
    if (!prebuiltUrl) return;
    try {
      await navigator.clipboard.writeText(prebuiltUrl);
      alert("Link copied to clipboard");
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = prebuiltUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      alert("Link copied to clipboard");
    }
  }, [prebuiltUrl]);

  // Open a floating window showing the call (Document Picture-in-Picture when available)
  const openPiP = useCallback(async () => {
    if (!prebuiltUrl) return;

    // Use Document Picture-in-Picture if supported (Chromium)
    const supportsDPiP =
      typeof window.documentPictureInPicture?.requestWindow === "function";

    try {
      if (supportsDPiP) {
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 420,
          height: 260,
        });
        pipWindowRef.current = pipWin;
        setPipOpen(true);

        const doc = pipWin.document;
        doc.body.style.margin = "0";
        const frame = doc.createElement("iframe");
        frame.src = prebuiltUrl;
        frame.style.cssText = "width:100%;height:100%;border:0;";
        frame.allow =
          "camera; microphone; fullscreen; display-capture; autoplay; clipboard-write; document-picture-in-picture";
        doc.body.appendChild(frame);

        // When user closes the PiP window
        pipWin.addEventListener("unload", () => {
          pipWindowRef.current = null;
          setPipOpen(false);
        });
      } else {
        // Fallback: open a small pop-out window
        const w = window.open(prebuiltUrl, "_blank", "width=420,height=260");
        if (w) {
          pipWindowRef.current = w;
          setPipOpen(true);
          const onClose = () => {
            pipWindowRef.current = null;
            setPipOpen(false);
          };
          w.addEventListener("unload", onClose);
        }
      }
    } catch (e) {
      console.error("Failed to open floating window", e);
    }
  }, [prebuiltUrl]);

  const closePiP = useCallback(() => {
    try {
      pipWindowRef.current?.close?.();
    } catch {}
    pipWindowRef.current = null;
    setPipOpen(false);
  }, []);

  // Keep PiP iframe URL in sync if room changes
  useEffect(() => {
    const w = pipWindowRef.current;
    if (!w || !prebuiltUrl) return;
    try {
      const frame = w.document?.querySelector?.("iframe");
      if (frame && frame.src !== prebuiltUrl) frame.src = prebuiltUrl;
    } catch {
      // ignore cross-origin access issues on fallback window
    }
  }, [prebuiltUrl]);

  // Auto-open PiP when tab is hidden (if enabled)
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && autoPin && !pipWindowRef.current) {
        openPiP();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [autoPin, openPiP]);

  if (!room) {
    return (
      <div
        className="fullscreen-call"
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <button onClick={startCall} disabled={loading}>
          {loading ? "Creating room..." : "Start a call"}
        </button>
      </div>
    );
  }

  return (
    <div className="fullscreen-call">
      <div className="fullscreen-call-header">
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 14 }}>Share link:</span>
          <input
            value={prebuiltUrl}
            readOnly
            style={{
              flex: "1 1 320px",
              minWidth: 240,
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #444",
              background: "transparent",
              color: "inherit",
            }}
          />
          <button onClick={copyLink} style={{ padding: "6px 12px" }}>
            Copy
          </button>
          <a
            href={prebuiltUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 14 }}
          >
            Open
          </a>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <label
              style={{
                fontSize: 12,
                opacity: 0.85,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <input
                type="checkbox"
                checked={autoPin}
                onChange={(e) => setAutoPin(e.target.checked)}
              />
              Auto-pin on tab switch
            </label>
            {!pipOpen ? (
              <button onClick={openPiP} style={{ padding: "6px 12px" }}>
                Pin
              </button>
            ) : (
              <button onClick={closePiP} style={{ padding: "6px 12px" }}>
                Unpin
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
          Room name: {room?.name}
        </div>
      </div>

      <iframe
        className="fullscreen-call-frame"
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write; document-picture-in-picture"
        allowFullScreen
        src={prebuiltUrl}
        title="Daily Prebuilt"
      />
    </div>
  );
}
