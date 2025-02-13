import { Button, Dialog, Heading } from "@airtable/blocks/ui";
import React, { createContext, useContext, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
const DialogContext = createContext({} as any);

function DialogContextProvider({ children }) {
	const [openDialog, setOpenDialog] = useState(false);
	const [text, setText] = useState<string>();
	const [header, setHeader] = useState<string>();
	const [callback, setCallback] = useState<() => void>(null);

	function setDialogContent(
		header: string,
		text: string,
		isOpen: boolean = false,
		nextCallback: () => any = null
	) {
		setText(text);
		setHeader(header);
		setOpenDialog(isOpen);
		setCallback(() => nextCallback);
	}

	useEffect(() => {
		if (!openDialog) {
			setText(null);
			setHeader(null);
			setCallback(null);
		}
	}, [openDialog]);

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
					<Dialog
						onClose={() => setOpenDialog(false)}
						width="320px"
					>
						<Dialog.CloseButton />
						<Heading>{header}</Heading>
						{(header.includes("Error") || header.includes("Erreur")) && (
							<p style={{ fontSize: "12px", fontWeight: "bold", paddingLeft: 4 }}>
								<FormattedMessage
									id="generics.error.note"
									defaultMessage="The operation was interrupted. Please fix the issue before retrying."
								/>
							</p>
						)}
						<p dangerouslySetInnerHTML={{ __html: text }} />
						<div style={{ display: "flex", gap: 4 }}>
							<Button onClick={() => setOpenDialog(false)}>
								<FormattedMessage
									id="generics.button.close"
									defaultMessage="Close"
								/>
							</Button>
							{callback && (
								<Button onClick={() => callback()}>
									<FormattedMessage
										id="generics.button.next"
										defaultMessage="Next"
									/>
								</Button>
							)}
						</div>
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
