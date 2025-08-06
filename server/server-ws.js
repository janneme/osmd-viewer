import { WebSocketServer } from "ws";
import axios from "axios";
import AdmZip from "adm-zip";
import { testFiles, localMxlPath } from "../config.js";
import fs from "fs";

// Simple in-memory cache
const fileCache = {};

const wss = new WebSocketServer({ port: 5174 });

function sendLocalMxl(ws) {
  if (localMxlPath) {
    fs.readFile(localMxlPath, (err, data) => {
      if (!err) {
        console.info("OUT: local_mxl", localMxlPath);
        ws.send(
          JSON.stringify({
            type: "local_mxl",
            content: data.toString("utf-8"),
            name: localMxlPath.split("/").pop(),
          }),
        );
      }
    });
  }
}

wss.on("connection", async (ws) => {
  // Send only the titles on connect
  ws.send(
    JSON.stringify({ type: "titles", titles: testFiles.map((f) => f.title) }),
  );
  // Send localMxlPath file if defined
  sendLocalMxl(ws);

  // Watch localMxlPath for changes and send new content
  if (localMxlPath) {
    let watcher = fs.watch(localMxlPath, (eventType) => {
      if (eventType === "change") {
        sendLocalMxl(ws);
      }
    });
    ws.on("close", () => {
      watcher.close();
    });
  }
  ws.on("message", async (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      return;
    }

    if (data.type === "getDetails") {
      console.info("IN: getDetails", data);
      const file = testFiles[data.index];
      if (!file) {
        ws.send(JSON.stringify({ type: "error", error: "Invalid index" }));
        return;
      }
      // Send details
      ws.send(JSON.stringify({ type: "details", details: file }));

      // Send .mxl
      try {
        const mxlName = file.mxl.split("/").pop();
        let mxlData = fileCache[file.mxl];
        if (!mxlData) {
          const mxlRes = await axios.get(file.mxl, {
            responseType: "arraybuffer",
          });
          mxlData = Buffer.from(mxlRes.data).toString("utf-8");
          fileCache[file.mxl] = mxlData;
        }
        console.info("OUT: mxl");
        ws.send(
          JSON.stringify({
            type: "mxl",
            content: mxlData,
            name: mxlName,
          }),
        );
      } catch (e) {
        ws.send(
          JSON.stringify({ type: "error", error: "Failed to fetch .mxl" }),
        );
      }

      // Send .pmw (unzipped)
      try {
        let pmwCacheKey = file.pmw + "|pmw";
        let pmwData = fileCache[pmwCacheKey];
        let pmwName = null;
        if (!pmwData) {
          const pmwRes = await axios.get(file.pmw, {
            responseType: "arraybuffer",
          });
          const zip = new AdmZip(Buffer.from(pmwRes.data));
          const pmwEntry = zip
            .getEntries()
            .find((e) => e.entryName.endsWith(".pmw"));
          if (pmwEntry) {
            pmwData = pmwEntry.getData().toString("base64");
            pmwName = pmwEntry.entryName;
            fileCache[pmwCacheKey] = pmwData;
            fileCache[pmwCacheKey + "|name"] = pmwName;
          } else {
            ws.send(
              JSON.stringify({ type: "error", error: "No .pmw file in zip" }),
            );
            return;
          }
        } else {
          pmwName = fileCache[pmwCacheKey + "|name"];
        }
        ws.send(
          JSON.stringify({
            type: "pmw",
            content: pmwData,
            name: pmwName,
          }),
        );
      } catch (e) {
        ws.send(
          JSON.stringify({ type: "error", error: "Failed to fetch .pmw" }),
        );
      }

      // Send .pdf
      try {
        const pdfName = file.pdf.split("/").pop();
        let pdfData = fileCache[file.pdf];
        if (!pdfData) {
          const pdfRes = await axios.get(file.pdf, {
            responseType: "arraybuffer",
          });
          pdfData = Buffer.from(pdfRes.data).toString("base64");
          fileCache[file.pdf] = pdfData;
        }
        ws.send(
          JSON.stringify({
            type: "pdf",
            content: pdfData,
            name: pdfName,
          }),
        );
      } catch (e) {
        ws.send(
          JSON.stringify({ type: "error", error: "Failed to fetch .pdf" }),
        );
      }
    }
  });
});

console.log("WebSocket server running on port 5174");
