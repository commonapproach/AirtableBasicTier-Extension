# AirTable Extension For Common Approach to Impact Measurement

This project is an Airtable extension designed to facilitate the seamless import and export of JSON-LD files, conforming to the Common Impact Data Standard. It's intended to streamline data management for social purpose organizations, enhancing their ability to measure and report impact.

## Features

- **Import Functionality**: Allows users to import data in JSON-LD format, conforming to the Common Impact Data Standard.
- **Export Functionality**: Enables users to export their Airtable data as JSON-LD files, adhering to the specified data standard.

## Prerequisites

- Node.js (version 14)
- Airtable account and base
- [Blocks CLI](https://airtable.com/developers/blocks/guides/cli-installation)

## Local Installation and Testing

1. **Clone the Repository:**
   ```
   git clone <repository-url>
   ```
2. **Navigate to Project Directory:**
   ```
   cd path/to/airtable-extension
   ```
3. **Install Dependencies:**
   ```
   npm install
   ```
4. **Set Up Airtable Base:**

   - Go to the Airtable webpage and create a new base.
   - Right-click on the 'Extensions' panel and select 'Add extension' > 'Build an extension'.

5. **Install Blocks CLI:**
   ```
   npm install -g @airtable/blocks-cli
   ```
6. **Initialize Your Local Development Environment:**

   - After adding a new extension in your base, follow the instructions to initialize your environment. Note the `blockId` and `baseId` values provided in Step 2.
   - Update the `.block/remote.json` file with these values.

   ```json
   {
     "blockId": "blkh8C3IN6ugCN7Zc",
     "baseId": "appY2vwHRzpToCxuv"
   }
   ```

7. **Run the Extension Locally:**

   - If needed, generate a personal access token following [these instructions](https://airtable.com/developers/web/guides/personal-access-tokens).
   - Set your API key:

     ```
     block set-api-key <YOUR-TOKEN>
     ```

   - Start the extension:

     ```
     block run
     ```

   - The extension will start on `localhost:9000`.

8. **Testing the Extension in Airtable:**
   - If the dialog in Airtable has closed, click on 'Edit extension' in the Extensions section.
   - In the dialog, enter `http://localhost:9000` and click on 'Start editing extension'.
   - Test the functionality of the extension.
   - To stop, click 'Stop developing' in the Airtable extension section and use `Ctrl + C` in the terminal.

## Contributing

Contributions to this project are welcome. Please ensure that your code adheres to the project's standards and guidelines.
