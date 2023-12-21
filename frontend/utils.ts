export const handleFileChange = async (event: any, onSuccess: (data: any) => void) => {
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
