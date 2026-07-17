export function printDonorCertificate(donor) {
  const certWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!certWindow) {
    alert("Popup blocked! Please allow popups for this site to print certificates.");
    return;
  }

  const formattedBg = (donor.bloodGroup || '').replace('+', '+Ve').replace('-', '-Ve');
  let displayDate = donor.lastDonationDate === 'Never' ? new Date().toISOString().substring(0,10) : donor.lastDonationDate;
  
  // Try formatting date to "DD-MMM-YYYY"
  let finalDateStr = displayDate;
  try {
    const dateParts = displayDate.split('-');
    if (dateParts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const year = dateParts[0];
      const month = months[parseInt(dateParts[1], 10) - 1];
      const day = parseInt(dateParts[2], 10);
      if (month) {
        finalDateStr = `${day}-${month}-${year}`;
      }
    }
  } catch (e) {
    console.warn("Date formatting failed, fallback to raw string");
  }

  certWindow.document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Certificate of Appreciation - ${donor.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap');
    @page {
      size: landscape;
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Outfit', 'Inter', sans-serif;
      background-color: #ffffff;
      color: #1e293b;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .certificate-container {
      width: 297mm;
      height: 210mm;
      box-sizing: border-box;
      padding: 24mm 24mm 16mm 24mm;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #ffffff;
    }
    .certificate-border {
      position: absolute;
      top: 10mm;
      left: 10mm;
      right: 10mm;
      bottom: 10mm;
      border: 6px double #c5a880;
      pointer-events: none;
    }
    .certificate-inner-border {
      position: absolute;
      top: 13mm;
      left: 13mm;
      right: 13mm;
      bottom: 13mm;
      border: 1px solid #e2d1b9;
      pointer-events: none;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2mm;
    }
    .header-logo {
      width: 64px;
      height: 64px;
      object-fit: contain;
    }
    .header-title-container {
      text-align: center;
      flex: 1;
      padding: 0 20px;
    }
    .org-main-title {
      font-size: 26px;
      font-weight: 900;
      color: #991b1b;
      margin: 0;
      letter-spacing: 2px;
      font-family: 'Outfit', sans-serif;
    }
    .org-subtitle {
      font-size: 11px;
      color: #64748b;
      margin: 4px 0 0 0;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .certificate-title {
      text-align: center;
      margin: 6mm 0 4mm 0;
    }
    .certificate-title h1 {
      font-size: 42px;
      font-family: 'Outfit', sans-serif;
      font-weight: 900;
      margin: 0;
      letter-spacing: 3px;
      background: linear-gradient(135deg, #b45309 30%, #991b1b 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-transform: uppercase;
    }
    .presented-to {
      text-align: center;
      font-size: 15px;
      color: #64748b;
      margin-bottom: 1mm;
      font-weight: 500;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .donor-name {
      text-align: center;
      font-size: 38px;
      font-weight: 800;
      color: #b45309;
      margin: 2mm 0;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      border-bottom: 2px solid #e2d1b9;
      display: inline-block;
      padding: 0 40px 6px 40px;
      font-family: 'Outfit', sans-serif;
    }
    .certificate-text {
      text-align: center;
      font-size: 14.5px;
      line-height: 1.75;
      color: #334155;
      max-width: 85%;
      margin: 4mm auto 8mm auto;
      font-weight: 400;
    }
    .certificate-details {
      display: flex;
      justify-content: space-around;
      background: #fdfbf7;
      border: 1px solid #f1e9dc;
      padding: 12px 24px;
      border-radius: 8px;
      max-width: 30%;
      margin: 0 auto 10mm auto;
    }
    .detail-box {
      text-align: center;
      flex: 1;
    }
    .detail-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 1px;
      margin-bottom: 5px;
      font-weight: 600;
    }
    .detail-val {
      font-size: 18px;
      font-weight: 800;
      color: #1e293b;
    }
    .footer {
      display: flex;
      justify-content: center;
      align-items: flex-end;
      padding: 0 15mm;
    }
    .slogan {
      font-size: 13px;
      font-weight: 800;
      color: #991b1b;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="certificate-container">
    <div class="certificate-border"></div>
    <div class="certificate-inner-border"></div>
    
    <div class="header">
      <img src="${window.location.origin}/icon.svg" class="header-logo" alt="Vardaan Logo">
      <div class="header-title-container">
        <h2 class="org-main-title">VARDAAN CHARITABLE BLOOD CENTRE</h2>
        <div class="org-subtitle">A Unit of Jansiksha Foundation | Sirsa, Haryana</div>
      </div>
      <img src="${window.location.origin}/icon.svg" class="header-logo" style="opacity: 0.08;" alt="Vardaan Logo">
    </div>
    
    <div class="certificate-title">
      <h1>Certificate of Appreciation</h1>
    </div>
    
    <div class="presented-to">Proudly Presented To</div>
    <div style="text-align: center;">
      <div class="donor-name">${donor.name}</div>
    </div>
    
    <p class="certificate-text">
      On <strong>${finalDateStr}</strong> for this benevolent gesture of donating blood which helped in saving precious human life. We compliment you and thank you on the behalf of Vardaan Charitable Blood Centre for this noble deed, which we are sure will be emulated by many other public spirited persons like you.
    </p>
    
    <div class="certificate-details">
      <div class="detail-box">
        <div class="detail-label">Blood Group</div>
        <div class="detail-val" style="color: #991b1b;">${formattedBg}</div>
      </div>
    </div>
    
    <div class="footer">
      <div style="display: flex; flex-direction: column; align-items: center;">
        <span class="slogan">Donate Blood, Save Life</span>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 500);
    };
  </script>
</body>
</html>
  `);
  certWindow.document.close();
}
