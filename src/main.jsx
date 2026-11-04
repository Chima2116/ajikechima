import { createRoot } from "react-dom/client";
import { ThemeProvider, usePal } from "./halaska-kit";
import Assistant from "./Assistant";

function Page() {
  const pal = usePal();
  return (
    <div style={{ minHeight: "100vh", background: pal.bg }}>
      <Assistant />
    </div>
  );
}

const param = new URLSearchParams(location.search).get("theme");
const dark = param ? param === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={dark ? "dark" : "light"}>
    <Page />
  </ThemeProvider>
);
