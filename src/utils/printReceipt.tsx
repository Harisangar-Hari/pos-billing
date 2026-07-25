// PrintReceipt.ts
// Works reliably on Chrome/Windows with Xprinter 72mm thermal printer
// Strategy: convert logo → base64 via canvas, build full HTML,
// wrap in a Blob URL, open that URL in a new tab, auto-print.

import logoSrc from "../assets/logo.jpeg";

export interface PrintItem {
    name: string;
    quantity: number;
    price: number;
}

export interface ReceiptData {
    invoiceNumber?: string;
    items: PrintItem[];
    customerName?: string;
    customerPhone?: string;
    total: number;
    paid: number;
    change?: number;
    balance?: number;
    paymentMode: "cash" | "credit";
}

// ── Step 1: convert the bundled asset to a base64 data URL ──────────────────
// We draw it onto a canvas so Chrome gives us a clean data URL
// regardless of how Vite/CRA hashed the filename.
function imageToBase64(src: string): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d")!.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", 0.92));
        };
        img.onerror = () => resolve(""); // skip logo if it fails, still print
        img.src = src;
    });
}

// ── Step 2: build the full HTML string ──────────────────────────────────────
function buildHTML(data: ReceiptData, logoB64: string): string {
    const now = new Date().toLocaleString("en-GB", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

    const rows = data.items.map((i) => `
    <tr>
      <td colspan="2" class="item-name">${i.name}</td>
    </tr>
    <tr>
      <td class="qty">${i.quantity} x ${i.price.toFixed(2)}</td>
      <td class="amount">${(i.quantity * i.price).toFixed(2)}</td>
    </tr>
  `).join("");

    const payRow = data.paymentMode === "cash"
        ? `<tr><td>Change</td><td class="amount">${(data.change ?? 0).toFixed(2)}</td></tr>`
        : `<tr><td>Balance</td><td class="amount">${(data.balance ?? 0).toFixed(2)}</td></tr>`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  /* ── Reset ── */
  * { margin: 0; padding: 0; box-sizing: border-box; }

  /* ── Page: exactly 72mm, unlimited height ── */
  @page { size: 72mm auto; margin: 2mm; }

  html, body {
    width: 72mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.45;
    color: #000 !important;
    background: #fff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .page { padding: 2mm 2mm 8mm 2mm; }

  /* ── Logo ── */
  .logo {
    display: block;
    width: 60px;
    height: auto;
    margin: 0 auto 4px;
  }

  /* ── Headings ── */
  .shop-name {
    text-align: center;
    font-size: 13px;
    font-weight: bold;
    margin-bottom: 2px;
  }
  .meta {
    text-align: center;
    font-size: 10px;
    line-height: 1.4;
  }

  /* ── Divider ── */
  .div {
    width: 100%;
    border: none;
    border-top: 1px dashed #000;
    margin: 4px 0;
  }

  /* ── Items table ── */
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  td { padding: 1px 0; font-size: 12px; }

  .item-name { font-size: 12px; }

  /* left col 58% / right col 42% */
  .qty    { width: 58%; font-size: 11px; }
  .amount { width: 42%; text-align: right; font-size: 11px; }

  /* Summary rows */
  .sum-label  { width: 55%; }
  .sum-amount { width: 45%; text-align: right; }

  .total-row td {
    font-size: 14px;
    font-weight: bold;
    padding-top: 2px;
  }

  /* ── Footer ── */
  .footer {
    text-align: center;
    font-size: 10px;
    margin-top: 3px;
  }
  .footer-brand { margin-top: 6px; font-size: 9px; }
</style>
</head>
<body>
<div class="page">

  ${logoB64 ? `<img class="logo" src="${logoB64}" />` : ""}

  <p class="shop-name">Karrali Manufacture &amp; Traders</p>
  <p class="meta">No 69, Palaly Road, Thirunelveli, Jaffna</p>
  <p class="meta">Tel: 0776925633</p>

  <hr class="div">

  ${data.invoiceNumber ? `<p class="meta">Invoice: ${data.invoiceNumber}</p>` : ""}
  <p class="meta">${now}</p>
  <p class="meta">Cashier: M. Thivaharan</p>

  <hr class="div">

  <table><tbody>${rows}</tbody></table>

  <hr class="div">

  <table>
    <tbody>
      <tr class="total-row">
        <td class="sum-label">TOTAL</td>
        <td class="sum-amount">${data.total.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="sum-label">Paid</td>
        <td class="sum-amount">${data.paid.toFixed(2)}</td>
      </tr>
      ${payRow}
    </tbody>
  </table>

  <hr class="div">

  <p class="footer">No Return &bull; No Cash Refund</p>
  <p class="footer">Thank You! Come Again</p>
  <p class="footer footer-brand">Powered by MYLInnovations Developers</p>

</div>

<script>
  // Images are already base64 inline — nothing to wait for.
  // Use requestAnimationFrame to ensure paint is complete before printing.
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      window.print();
      setTimeout(function() { window.close(); }, 1500);
    });
  });
</script>
</body>
</html>`;
}

// ── Step 3: turn the HTML into a Blob URL and open it ───────────────────────
// Chrome treats blob: URLs as real pages — full CSS, no sandbox restrictions.
export async function printReceipt(data: ReceiptData): Promise<void> {
    const logoB64 = await imageToBase64(logoSrc);
    const html = buildHTML(data, logoB64);

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const win = window.open(url, "_blank");

    // Release the blob URL after the window has loaded it
    if (win) {
        win.addEventListener("load", () => {
            URL.revokeObjectURL(url);
        });
    }
}