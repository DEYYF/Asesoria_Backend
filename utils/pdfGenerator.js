const PDFDocument = require('pdfkit');

/**
 * Genera un PDF de factura legal española
 * @param {Object} factura - Objeto de factura de la base de datos
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
async function generateInvoicePDF(factura) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        info: {
          Title: `Factura ${factura.numeroFactura}`,
          Author: factura.datosEmisor.nombre
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Colores
      const primaryColor = '#2563eb';
      const grayColor = '#6b7280';
      const darkColor = '#111827';

      // CABECERA
      doc.fontSize(24)
         .fillColor(primaryColor)
         .text('FACTURA', 50, 50);

      doc.fontSize(10)
         .fillColor(grayColor)
         .text(factura.numeroFactura, 50, 80);

      // Datos del emisor (derecha)
      const emisorX = 350;
      doc.fontSize(10)
         .fillColor(darkColor)
         .font('Helvetica-Bold')
         .text(factura.datosEmisor.nombre, emisorX, 50);

      doc.font('Helvetica')
         .fillColor(grayColor)
         .fontSize(9)
         .text(`NIF: ${factura.datosEmisor.nif}`, emisorX, 65)
         .text(factura.datosEmisor.direccion, emisorX, 78)
         .text(`${factura.datosEmisor.codigoPostal} ${factura.datosEmisor.ciudad}`, emisorX, 91);

      if (factura.datosEmisor.telefono) {
        doc.text(`Tel: ${factura.datosEmisor.telefono}`, emisorX, 104);
      }
      doc.text(factura.datosEmisor.email, emisorX, 117);

      // Línea separadora
      doc.moveTo(50, 150)
         .lineTo(545, 150)
         .strokeColor('#e5e7eb')
         .stroke();

      // DATOS DEL CLIENTE
      let yPos = 170;
      doc.fontSize(10)
         .fillColor(grayColor)
         .text('FACTURAR A:', 50, yPos);

      yPos += 15;
      doc.font('Helvetica-Bold')
         .fillColor(darkColor)
         .text(factura.datosReceptor.nombre, 50, yPos);

      yPos += 13;
      doc.font('Helvetica')
         .fillColor(grayColor)
         .fontSize(9)
         .text(`NIF: ${factura.datosReceptor.nif}`, 50, yPos);

      yPos += 13;
      doc.text(factura.datosReceptor.direccion, 50, yPos);

      yPos += 13;
      doc.text(`${factura.datosReceptor.codigoPostal} ${factura.datosReceptor.ciudad}`, 50, yPos);

      // FECHAS (derecha)
      let yPosRight = 170;
      doc.fontSize(9)
         .fillColor(grayColor)
         .text('Fecha emisión:', emisorX, yPosRight);
      doc.fillColor(darkColor)
         .text(new Date(factura.fecha).toLocaleDateString('es-ES'), emisorX + 80, yPosRight);

      yPosRight += 15;
      doc.fillColor(grayColor)
         .text('Vencimiento:', emisorX, yPosRight);
      doc.fillColor(darkColor)
         .text(new Date(factura.vencimiento).toLocaleDateString('es-ES'), emisorX + 80, yPosRight);

      yPosRight += 15;
      doc.fillColor(grayColor)
         .text('Estado:', emisorX, yPosRight);
      
      const estadoColor = factura.estado === 'pagada' ? '#10b981' : 
                         factura.estado === 'vencida' ? '#ef4444' : '#f59e0b';
      doc.fillColor(estadoColor)
         .text(factura.estado.toUpperCase(), emisorX + 80, yPosRight);

      // CONCEPTO
      yPos += 30;
      doc.fontSize(10)
         .fillColor(grayColor)
         .text('CONCEPTO:', 50, yPos);

      yPos += 15;
      doc.fontSize(11)
         .fillColor(darkColor)
         .font('Helvetica-Bold')
         .text(factura.concepto, 50, yPos, { width: 495 });

      // TABLA DE ITEMS
      yPos += 40;
      const tableTop = yPos;

      // Cabecera de tabla
      doc.rect(50, tableTop, 495, 25)
         .fillAndStroke(primaryColor, primaryColor);

      doc.fontSize(9)
         .fillColor('white')
         .font('Helvetica-Bold')
         .text('DESCRIPCIÓN', 60, tableTop + 8, { width: 220 })
         .text('CANT.', 290, tableTop + 8, { width: 40, align: 'center' })
         .text('PRECIO', 340, tableTop + 8, { width: 60, align: 'right' })
         .text('IVA', 410, tableTop + 8, { width: 40, align: 'right' })
         .text('TOTAL', 460, tableTop + 8, { width: 75, align: 'right' });

      // Items
      yPos = tableTop + 35;
      doc.font('Helvetica')
         .fillColor(darkColor);

      factura.items.forEach((item, index) => {
        const bgColor = index % 2 === 0 ? '#f9fafb' : 'white';
        doc.rect(50, yPos - 5, 495, 25)
           .fill(bgColor);

        doc.fontSize(9)
           .fillColor(darkColor)
           .text(item.descripcion, 60, yPos, { width: 220 })
           .text(item.cantidad.toString(), 290, yPos, { width: 40, align: 'center' })
           .text(`${item.precioUnitario.toFixed(2)}€`, 340, yPos, { width: 60, align: 'right' })
           .text(`${item.iva}%`, 410, yPos, { width: 40, align: 'right' })
           .text(`${item.total.toFixed(2)}€`, 460, yPos, { width: 75, align: 'right' });

        yPos += 25;
      });

      // TOTALES
      yPos += 20;
      const totalesX = 380;

      const subtotalFactura = Number(factura.subtotal || 0);
      const descuentoImporte = subtotalFactura * (Number(factura.descuentoGlobal || 0) / 100);
      const baseImponible = Math.max(0, subtotalFactura - descuentoImporte);

      doc.fontSize(9)
         .fillColor(grayColor)
         .text('Subtotal:', totalesX, yPos)
         .fillColor(darkColor)
         .text(`${subtotalFactura.toFixed(2)}€`, totalesX + 80, yPos, { align: 'right', width: 85 });

      if (factura.descuentoGlobal > 0) {
        yPos += 15;
        doc.fillColor(grayColor)
           .text(`Descuento (${factura.descuentoGlobal}%):`, totalesX, yPos)
           .fillColor('#ef4444')
           .text(`-${descuentoImporte.toFixed(2)}€`, totalesX + 80, yPos, { align: 'right', width: 85 });

        yPos += 15;
        doc.fillColor(grayColor)
           .text('Base imponible:', totalesX, yPos)
           .fillColor(darkColor)
           .text(`${baseImponible.toFixed(2)}€`, totalesX + 80, yPos, { align: 'right', width: 85 });
      }

      yPos += 15;
      doc.fillColor(grayColor)
         .text('IVA:', totalesX, yPos)
         .fillColor(darkColor)
         .text(`${factura.totalIVA.toFixed(2)}€`, totalesX + 80, yPos, { align: 'right', width: 85 });

      yPos += 20;
      doc.rect(totalesX, yPos - 5, 165, 30)
         .fillAndStroke(primaryColor, primaryColor);

      doc.fontSize(11)
         .fillColor('white')
         .font('Helvetica-Bold')
         .text('TOTAL:', totalesX + 10, yPos + 5)
         .fontSize(13)
         .text(`${factura.total.toFixed(2)}€`, totalesX + 80, yPos + 5, { align: 'right', width: 75 });

      // NOTAS
      if (factura.notas) {
        yPos += 50;
        doc.fontSize(9)
           .fillColor(grayColor)
           .font('Helvetica-Bold')
           .text('NOTAS:', 50, yPos);

        yPos += 15;
        doc.font('Helvetica')
           .fillColor(darkColor)
           .text(factura.notas, 50, yPos, { width: 495 });
      }

      // PIE DE PÁGINA
      const footerY = 750;
      doc.fontSize(8)
         .fillColor(grayColor)
         .text('Esta factura se ha generado electrónicamente y es válida sin firma.', 50, footerY, { 
           align: 'center', 
           width: 495 
         });

      doc.fontSize(7)
         .text(`Método de pago: ${factura.metodoPago}`, 50, footerY + 15, { 
           align: 'center', 
           width: 495 
         });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateInvoicePDF
};
