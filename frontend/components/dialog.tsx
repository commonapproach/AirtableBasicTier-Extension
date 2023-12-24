import { Button, Dialog as ATDialog, Heading, Text } from "@airtable/blocks/ui";
import React, { useState } from "react";

export const Dialog = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  return (
    <React.Fragment>
      <Button onClick={() => setIsDialogOpen(true)}>Open dialog</Button>
      {isDialogOpen && (
        <ATDialog onClose={() => setIsDialogOpen(false)} width="320px">
          <ATDialog.CloseButton />
          <Heading>Dialog</Heading>
          <Text variant="paragraph">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam neque dui, euismod ac quam eget, pretium cursus
            nisl.
          </Text>
          <Button onClick={() => setIsDialogOpen(false)}>Close</Button>
        </ATDialog>
      )}
    </React.Fragment>
  );
};
