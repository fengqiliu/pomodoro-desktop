import React from "react";
import ReactDOM from "react-dom/client";
import App from "./presentation/App";
// Must load after App (and so after every component stylesheet): its
// :focus-visible ring wins equal-specificity ties with component rules.
import "./presentation/a11y.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
