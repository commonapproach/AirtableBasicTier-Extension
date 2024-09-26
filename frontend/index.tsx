import { Button, Icon, Text, TextButton, initializeBlock, useBase } from "@airtable/blocks/ui";
import React, { useEffect, useRef, useState } from "react";
import { FormattedMessage, IntlProvider, useIntl } from "react-intl";
import ExportDialog from "./components/ExportDialog";
import Loading from "./components/Loading";
import DialogContextProvider, { useDialog } from "./context/DialogContext";
import { createSFFModuleTables } from "./helpers/createSFFModuleTables";
import { createTables } from "./helpers/createTables";
import { importData } from "./import/import";
import English from "./localization/en.json";
import French from "./localization/fr.json";
import { handleFileChange } from "./utils";

function Main() {
	const base = useBase();
	const fileInputRef = useRef(null);
	const menuRef = useRef<HTMLMenuElement>(null);
	const { setDialogContent } = useDialog();
	const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const intl = useIntl();

	const handleButtonClick = () => {
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
		// Open the file dialog
		fileInputRef.current.click();
	};

	const handleMenuClick = () => {
		if (menuRef.current) {
			if (menuRef.current.style.display === "none") {
				menuRef.current.style.display = "flex";
			} else {
				menuRef.current.style.display = "none";
			}
		}
	};

	const handleDismissMenuClick = (e) => {
		if (menuRef.current && !menuRef.current.contains(e.target)) {
			menuRef.current.style.display = "none";
		}
	};

	useEffect(() => {
		document.addEventListener("mousedown", handleDismissMenuClick);
		return () => {
			document.removeEventListener("mousedown", handleDismissMenuClick);
		};
	}, []);

	return (
		<>
			<Loading isLoading={isLoading} />
			<ExportDialog
				base={base}
				isDialogOpen={isExportDialogOpen}
				setDialogOpen={setIsExportDialogOpen}
			/>
			<div style={{ padding: 12 }}>
				<div
					style={{
						width: "100%",
						display: "flex",
						flexDirection: "row",
						justifyContent: "space-evenly",
						gap: 4,
					}}
				>
					<Button
						style={{
							border: "1px solid #3caea3",
							backgroundColor: "rgba(0,0,0,0)",
						}}
						onClick={handleButtonClick}
						disabled={isImporting}
					>
						<div
							style={{
								alignItems: "center",
								textAlign: "center",
								display: "flex",
								gap: 2,
								color: "#3caea3",
							}}
						>
							<Icon
								name="upload"
								size={16}
							/>
							<FormattedMessage
								id="app.button.importData"
								defaultMessage="Import Data"
							/>
						</div>
					</Button>
					<input
						type="file"
						ref={fileInputRef}
						onChange={async (e) => {
							handleFileChange(
								e,
								async (jsonData) => {
									setIsLoading(true);
									try {
										await importData(jsonData, base, setDialogContent, setIsImporting, intl);
									} catch (error) {
										console.log("error", error);
										setIsImporting(false);
										setDialogContent(
											intl.formatMessage({
												id: "generics.error",
												defaultMessage: "Error",
											}),
											error.message ||
												intl.formatMessage({
													id: "generics.error.message",
													defaultMessage: "Something went wrong",
												}),
											true
										);
									}
									// Reset the input value
									if (document.body.contains(e.target)) {
										e.target.value = "";
									}
									setIsLoading(false);
								},
								(error) => {
									console.log("error", error);
									setDialogContent(
										intl.formatMessage({
											id: "generics.error",
											defaultMessage: "Error",
										}),
										error.message ||
											intl.formatMessage({
												id: "generics.error.message",
												defaultMessage: "Something went wrong",
											}),
										true
									);
								},
								intl
							);
						}}
						style={{ display: "none" }}
					/>
					<Button
						style={{
							border: "1px solid #50b7e0",
							backgroundColor: "rgba(0,0,0,0)",
						}}
						disabled={isImporting}
						onClick={async () => {
							setIsExportDialogOpen(true);
						}}
					>
						<div
							style={{
								alignItems: "center",
								textAlign: "center",
								display: "flex",
								gap: 2,
								color: "#50b7e0",
							}}
						>
							<Icon
								name="download"
								size={16}
							/>
							<FormattedMessage
								id="app.button.exportData"
								defaultMessage="Export Data"
							/>
						</div>
					</Button>
					<Button
						style={{
							border: "1px solid #2d62d7",
							backgroundColor: "rgba(0,0,0,0)",
						}}
						disabled={isImporting}
						onClick={async () => {
							setIsLoading(true);
							try {
								await createTables(intl);
								setDialogContent(
									intl.formatMessage({
										id: "generics.success",
										defaultMessage: "Success",
									}),
									intl.formatMessage({
										id: "createTables.messages.success",
										defaultMessage: "Tables created successfully",
									}),
									true
								);
							} catch (error) {
								setDialogContent(
									intl.formatMessage({
										id: "generics.error",
										defaultMessage: "Error",
									}),
									error.message ||
										intl.formatMessage({
											id: "generics.error.message",
											defaultMessage: "Something went wrong",
										}),
									true
								);
							}
							setIsLoading(false);
						}}
					>
						<div
							style={{
								alignItems: "center",
								textAlign: "center",
								display: "flex",
								gap: 2,
								color: "#2d62d7",
							}}
						>
							<Icon
								name="plus"
								size={16}
							/>
							<FormattedMessage
								id="app.button.createTables"
								defaultMessage="Create Tables"
							/>
						</div>
					</Button>
					<section
						style={{
							position: "relative",
						}}
					>
						<Button
							style={{
								border: "1px solid #1B4B9D",
								backgroundColor: "rgba(0,0,0,0)",
							}}
							onClick={handleMenuClick}
						>
							<Icon
								fillColor="#1B4B9D"
								name="menu"
								size={16}
							/>
						</Button>
						<menu
							ref={menuRef}
							style={{
								position: "absolute",
								top: 20,
								right: 0,
								display: "none",
								backgroundColor: "#fff",
								border: "1px solid #1B4B9D",
								borderRadius: 5,
								padding: 5,
								zIndex: 1,
								width: 120,
								flexDirection: "column",
								justifyContent: "center",
								alignItems: "center",
								gap: 5,
							}}
						>
							<TextButton
								style={{
									marginTop: 5,
									marginBottom: 5,
								}}
								disabled={isImporting}
								onClick={async () => {
									setIsLoading(true);
									try {
										await createSFFModuleTables(intl);
										setDialogContent(
											intl.formatMessage({
												id: "generics.success",
												defaultMessage: "Success",
											}),
											intl.formatMessage({
												id: "createTables.messages.success",
												defaultMessage: "Tables created successfully",
											}),
											true
										);
									} catch (error) {
										setDialogContent(
											intl.formatMessage({
												id: "generics.error",
												defaultMessage: "Error",
											}),
											error.message ||
												intl.formatMessage({
													id: "generics.error.message",
													defaultMessage: "Something went wrong",
												}),
											true
										);
									}
									setIsLoading(false);
								}}
							>
								<div
									style={{
										alignItems: "center",
										textAlign: "center",
										display: "flex",
										gap: 2,
										color: "#A6A6A6",
									}}
								>
									<Icon
										name="plus"
										size={16}
									/>
									<FormattedMessage
										id="app.button.createSFFTables"
										defaultMessage="SFF Tables"
									/>
								</div>
							</TextButton>
							<TextButton
								style={{
									marginTop: 5,
									marginBottom: 5,
								}}
								disabled={isImporting}
								onClick={async () => {
									window.open(
										"https://www.commonapproach.org/wp-content/uploads/2024/02/Common-Approach_Guide-for-Basic-Tier-Template-for-Airtable-version-2024-01-16.pdf"
									);
								}}
							>
								<div
									style={{
										alignItems: "center",
										textAlign: "center",
										display: "flex",
										gap: 2,
										color: "#FF8B3C",
									}}
								>
									<Icon
										name="book"
										size={16}
									/>
									<FormattedMessage
										id="app.button.userGuide"
										defaultMessage="User Guide"
									/>
								</div>
							</TextButton>
						</menu>
					</section>
				</div>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						justifyContent: "center",
						alignItems: "center",
						height: "80vh",
					}}
				>
					<img
						src="https://www.commonapproach.org/wp-content/uploads/2022/02/Common-Approach-logo_symbol-only.png"
						alt="Common Approach To Impact Measurement"
						width={200}
					/>
					<Text
						variant="paragraph"
						style={{ margin: 10 }}
					>
						<FormattedMessage
							id="app.description"
							defaultMessage="Compliant with Common Impact Data Standard Version 2.1"
						/>
					</Text>
					<Text>
						<strong>
							<FormattedMessage
								id="app.standardTier"
								defaultMessage="Basic Tier"
							/>
						</strong>
					</Text>
					<Text
						fontSize={"0.75rem"}
						fontWeight={600}
						style={{ marginTop: 5 }}
					>
						<FormattedMessage
							id="app.getSampleData"
							defaultMessage="New user? Try importing this"
						/>
						&nbsp;
						<a
							href="https://ontology.commonapproach.org/examples/CIDSBasicZerokitsTestData-SHARED.json"
							rel="noreferrer"
							download
						>
							<FormattedMessage
								id="app.link.sampleData"
								defaultMessage="sample data file"
							/>
						</a>
					</Text>
				</div>
			</div>
		</>
	);
}

initializeBlock(() => {
	const browserLanguage = navigator.language.toLowerCase();
	let language = "en";

	if (browserLanguage === "fr" || browserLanguage === "fr-fr" || browserLanguage === "fr-ca") {
		language = "fr";
	}

	return (
		<IntlProvider
			locale={language}
			defaultLocale="en"
			messages={language === "fr" ? French : English}
		>
			<DialogContextProvider>
				<Main />
			</DialogContextProvider>
		</IntlProvider>
	);
});
