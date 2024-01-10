import { Button, Dialog, Heading } from "@airtable/blocks/ui";
import React, { useState, createContext, useContext } from "react";
const DialogContext = createContext({} as any);

function DialogContextProvider({ children }) {
  const [openDialog, setOpenDialog] = useState(false);
  const [text, setText] = useState<string>();
  const [header, setHeader] = useState<string>();

  function setDialogContent(
    header: string,
    text: string,
    isOpen: boolean = false
  ) {
    setText(text);
    setHeader(header);
    setOpenDialog(isOpen);
  }

  return (
    <DialogContext.Provider
      value={{
        openDialog,
        setOpenDialog,
        setText,
        setHeader,
        setDialogContent,
      }}
    >
      <React.Fragment>
        {openDialog && (
          <Dialog onClose={() => setOpenDialog(false)} width="320px">
            <Dialog.CloseButton />
            <Heading>{header}</Heading>
            <p dangerouslySetInnerHTML={{ __html: text }} />

            <Button onClick={() => setOpenDialog(false)}>Close</Button>
          </Dialog>
        )}
      </React.Fragment>
      {children}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}

export default DialogContextProvider;
