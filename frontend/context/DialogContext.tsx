import { Button, Dialog, Heading, Text } from "@airtable/blocks/ui";
import React, { useState, createContext, useContext } from "react";
const DialogContext = createContext({} as any);

function DialogContextProvider({ children }) {
  const [openDialog, setOpenDialog] = useState(false);
  const [text, setText] = useState();
  const [header, setHeader] = useState();
  return (
    <DialogContext.Provider value={{ openDialog, setOpenDialog, setText, setHeader }}>
      <React.Fragment>
        {openDialog && (
          <Dialog onClose={() => setOpenDialog(false)} width="320px">
            <Dialog.CloseButton />
            <Heading>{header}</Heading>
            <Text variant="paragraph">{text}</Text>
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
