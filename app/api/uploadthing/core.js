import { createUploadthing } from "uploadthing/next";

const f = createUploadthing();

// File Router for Zenith Restaurant RMS
export const ourFileRouter = {
  // Define image uploader route
  imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for url:", file.url);
      return { url: file.url };
    }),
};
