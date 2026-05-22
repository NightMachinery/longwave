import "./index.css";
import "rc-slider/assets/index.css";
import "tippy.js/dist/tippy.css";

import React, { Suspense } from "react";
import ReactDOM from "react-dom";

import App from "./components/App";

// import i18n (needs to be bundled ;))
import "./i18n";

ReactDOM.render(
  <React.StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <App />
    </Suspense>
  </React.StrictMode>,
  document.getElementById("root")
);

//ReactDOM.render(
//  <React.StrictMode>
//            <App/>
//  </React.StrictMode>,
//  document.getElementById("root")
//);
