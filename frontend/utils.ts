/**
 * Handles the change event of a file input element.
 * Reads the selected file, checks if it has a ".jsonld" extension,
 * and if so, reads the file content as text and parses it as JSON.
 * Finally, calls the `onSuccess` callback function with the parsed JSON data.
 * @param event - The event object triggered by the file input element.
 * @param onSuccess - A callback function that will be called with the parsed JSON data.
 * @returns Promise<void>
 */
export const handleFileChange = async (
  event: any,
  onSuccess: (data: any) => void
): Promise<void> => {
  const file = event.target.files[0];
  if (file && file.name.endsWith(".jsonld")) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = JSON.parse(e.target.result as any);
      onSuccess(data);
    };
    reader.readAsText(file);
  } else {
    alert("Please select a JSON-LD file.");
  }
};

/**
 * Downloads a JSON-LD file by converting the data into a JSON string,
 * creating a Blob object with the JSON string, and generating a download link for the Blob object.
 * When the link is clicked, the file is downloaded.
 *
 * @param data - The data to be downloaded as a JSON-LD file.
 * @param filename - The name of the downloaded file.
 * @returns void
 */
export function downloadJSONLD(data: any, filename: string): void {
  const jsonldString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonldString], { type: "application/ld+json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Executes tasks in batches, where each task operates on a batch of items.
 * @param items - The array of items to be processed.
 * @param task - A function that processes a batch of items and returns a Promise.
 * @param batchSize - The number of items to process in each batch. (default: 50)
 */
export async function executeInBatches<T>(
  items: T[],
  task: (batch: T[]) => Promise<void>,
  batchSize: number = 50
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await task(batch);
    // console.log(`Deleted batch: ${i / batchSize + 1}`, batch);
  }
}

export function getActualFieldType(type: string): string {
  switch (type) {
    case "string":
      return "singleLineText";
    case "text":
      return "multilineText";
    case "i72":
      return "singleLineText";
    case "link":
      return "multipleRecordLinks";
    default:
      return type;
  }
}
