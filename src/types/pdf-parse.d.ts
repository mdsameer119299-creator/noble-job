declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string
    numpages: number
    info?: unknown
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>
  export default pdfParse
}

declare module "pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js" {
  const PDFJS: unknown
  export default PDFJS
}
