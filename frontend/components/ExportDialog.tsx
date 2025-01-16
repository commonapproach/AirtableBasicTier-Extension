import Base from "@airtable/blocks/dist/types/src/models/base";
import { Button, Dialog, Input, Text } from "@airtable/blocks/ui";
import React, { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useDialog } from "../context/DialogContext";
import { exportData } from "../export/export";

interface ExportDialogProps {
	base: Base;
	isDialogOpen: boolean;
	setDialogOpen: (isOpen: boolean) => void;
	setIsLoading: (isLoading: boolean) => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
	base,
	isDialogOpen,
	setDialogOpen,
	setIsLoading,
}) => {
	const { setDialogContent } = useDialog();
	const [inputValue, setInputValue] = useState("");
	const intl = useIntl();

	const handleExport = async () => {
		// Clean the input value to make it compatible with all file systems
		const cleanedOrgName = inputValue.replace(/[^\w]/gi, "");

		// Check if the input value is empty
		if (!cleanedOrgName) {
			setDialogContent(
				intl.formatMessage({
					id: "generics.error",
					defaultMessage: "Error",
				}),
				intl.formatMessage({
					id: "export.messages.error.missingOrganizationOnExport",
					defaultMessage: "Please enter the name of the organization you want to export",
				}),
				true
			);
			return;
		}

		// Close the dialog
		setDialogOpen(false);

		// Set the cleaned org name using the provided hook
		try {
			setIsLoading(true);
			await exportData(base, setDialogContent, cleanedOrgName, intl);
		} catch (error) {
			setDialogContent(
				intl.formatMessage({
					id: "generics.error",
					defaultMessage: "Error",
				}),
				error.message ||
					`${intl.formatMessage({
						id: "generics.error.message",
						defaultMessage: "Something went wrong",
					})}`,
				true
			);
		} finally {
			setIsLoading(false);
		}

		setInputValue("");
	};

	return (
		<>
			{isDialogOpen && (
				<Dialog
					onClose={() => {
						setDialogOpen(false);
					}}
					width="320px"
				>
					<Dialog.CloseButton />
					<Text variant="paragraph">
						<FormattedMessage
							id="export.messages.enterOrganization"
							defaultMessage="Enter the name of the organization you want to export:"
						/>
					</Text>
					<div style={{ marginBottom: 12 }}>
						<Input
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							placeholder={intl.formatMessage({
								id: "export.placeholder.organization",
								defaultMessage: "Enter organization name",
							})}
						/>
					</div>
					<div style={{ display: "flex", gap: 4 }}>
						<Button onClick={handleExport}>
							<FormattedMessage
								id="export.button.export"
								defaultMessage="Export"
							/>
						</Button>
					</div>
				</Dialog>
			)}
		</>
	);
};

export default ExportDialog;
