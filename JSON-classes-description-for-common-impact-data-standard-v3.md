# JSON classes description for common impact data standard version 3.0

This document describes the JSON classes for the Common Impact Data Standard (CIDS) version 3.0 basic tier. The intention of this document is to provide a guide for developers to understand the structure of the CIDS ontology and how to represent data in JSON format. The classes described in this document will be used in the development of the AirTable Extension and the Excel Add-in.

## Classes

The following classes are part of the CIDS ontology and are part of the basic tier of the standard.

### cids:Organization

```json
{
  "@context": "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
  "@type": "cids:Organization",
  "@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/",
  "org:hasLegalName": "<ORGANIZATION_NAME>",
  "ic:hasAddress": [
    "<ADDRESS_ID>",
    "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Address/<ADDRESS_ID>",
    "..."
  ],
  "hasOutcome": [
    "<OUTCOME_ID>",
    "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Outcome/<NAME_OF_OUTCOME>",
    "..."
  ],
  "hasIndicator": [
    "<INDICATOR_ID>",
    "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Indicator/<INDICATOR_NAME>",
    "..."
  ]
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- org:hasLegalName - string, required on export / warning on import, default value "";
- ic:hasAddress - strings array, default value [];
- hasIndicator - strings array, default value [];
- hasOutcome - strings array, default value [];

#### Accepted field names on import:

- Organization Name: org:hasLegalName or hasLegalName
- Address: ic:hasAddress or hasAddress

### cids:Theme

```json
{
  "@context": "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
  "@type": "cids:Theme",
  "@id": "<URI_FORMAT_ID>",
  "hasName": "<THEME_NAME>",
  "hasDescription": "<THEME_DESCRIPTION>"
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- hasName - string, required on export / warning on import, default value "";
- hasDescription - string, default value "";

### cids:Outcome

```json
{
  "@context": "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
  "@type": "cids:Outcome",
  "@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Outcome/<OUTCOME_NAME_URI_FORMAT>",
  "hasName": "<OUTCOME_NAME>",
  "hasDescription": "<OUTCOME_DESCRIPTION>",
  "forTheme": [ "<THEME_ID>", ... ],
  "forOrganization": "<ORGANIZATION_ID>",
  "hasIndicator": [ "<INDICATOR_ID>", "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Indicator/<INDICATOR_NAME>", "..." ]
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- hasName - string, required on export / warning on import, default value "";
- hasDescription - string, default value "";
- forTheme - strings array, warning, default value [];
- forOrganization - string, required on export / warning on import, default value "";

### cids:Indicator

```json
{
  "@context": "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
  "@type": "cids:Indicator",
  "@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Indicator/<INDICATOR_NAME_URI_FORMAT>",
  "hasName": "<INDICATOR_NAME>",
  "hasDescription": "<INDICATOR_DESCRIPTION>",
  "forOrganization": "<ORGANIZATION_ID>",
  "hasIndicatorReport": [
    "<INDICATOR_REPORT_ID>",
    "http://<ORGANIZATION_NAME_URL_FORMAT>.org/IndicatorReport/<INDICATOR_NAME_URI_FORMAT>/<INDICATOR_REPORT_REFERENCE>",
    "..."
  ]
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- hasName - string, required on export / warning on import, default value "";
- hasDescription - string, default value "";
- forOrganization - string, required on export / warning on import, default value "";
- hasIndicatorReport - strings array, warning, default value [];

### cids:IndicatorReport

```json
{
  "@context": "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
  "@type": "cids:IndicatorReport",
  "@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/IndicatorReport/<INDICATOR_NAME_URI_FORMAT>/<IDICATOR_REPORT_REFERENCE>",
  "hasName": "<INDICATOR_REPORT_NAME>",
  "hasComment": "<INDICATOR_REPORT_COMMENTS>",
  "i72:value": {
    "@context": "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
    "@type": "i72:Measure",
    "i72:numerical_value": "<NUMERICAL_VALUE_AS_STRING>",
    "i72:unit_of_measure": "<STRING>"
  },
  "time:hasTime": {
    "@context": "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
    "@type": "time:DateTimeInterval",
    "time:hasBeginning": {
      "@context": "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
      "@type": "time:Instant",
      "time:inXSDDateTimeStamp": "<xsd:dateTimeStamp>"
    },
    "time:hasEnd": {
      "@context": "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
      "@type": "time:Instant",
      "time:inXSDDateTimeStamp": "<xsd:dateTimeStamp>"
    }
  },
  "forIndicator": "<INDICATOR_ID>"
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- hasName - string, required on export / warning on import, default value "";
- hasComment - string, default value "";
- i72:value - object, default value class with all fields empty;
- i72:value.i72:numerical_value - string, default value "";
- i72:value.i72:unit_of_measure - string, default value "";
- time:hasTime - object, default value class with all fields empty;
- time:hasTime.time:hasBeginning - object, default value class with all fields empty;
- time:hasTime.time:hasBeginning.time:inXSDDateTimeStamp - string, default value "";
- time:hasTime.time:hasEnd - object, default value class with all fields empty; // Same fields as time:hasBeginning
- forIndicator - string, required on export / warning on import, default value "";

#### Accepted field names on import:

- i72:value - i72:value or value
- all fields on i72:Measure object will be accept with or without the i72: prefix
- time:hasTime - time:hasTime or hasTime
- time:hasTime.time:hasBeginning - time:hasTime.time:hasBeginning or hasTime.time:hasBeginning
- time:hasTime.time:hasEnd - time:hasTime.time:hasEnd or hasTime.time:hasEnd
- all fields on time:DateTimeDescription object will be accept with or without the time: prefix

### ic:Address

```json
{
  "@context": "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
  "@type": "ic:Address",
  "@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Address/<ADDRESS_ID>",
  "ic:hasStreet": "<STREET_NAME>",
  "ic:hasStreetType": "<ONE_OF_{ic:avenue, ic:boulevard, ic:circle, ic:crescent, ic:drive, ic:road, ic:street}>",
  "ic:hasStreetNumber": "<STREET_NUMBER>",
  "ic:hasStreetDirection": "<ONE_OF_{ic:east, ic:north, ic:south, ic:west}>",
  "ic:hasUnitNumber": "<UNIT_NUMBER>",
  "ic:hasCity": "<CITY_NAME>",
  "ic:hasState": "<STATE_2_LETTER_CODE>",
  "ic:hasPostalCode": "<POSTAL_CODE>",
  "ic:hasCountry": "<COUNTRY_2_LETTER_CODE>"
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- ic:hasStreet - string, required on export / warning on import, default value "";
- ic:hasStreetType - string, required on export / warning on import, default value "";
- ic:hasStreetNumber - string, required on export / warning on import, default value "";
- ic:hasStreetDirection - string, required on export / warning on import, default value "";
- ic:hasUnitNumber - string, required on export / warning on import, default value "";
- ic:hasCity - string, required on export / warning on import, default value "";
- ic:hasProvince - string, required on export / warning on import, default value "";
- ic:hasPostalCode - string, required on export / warning on import, default value "";
- ic:hasCountry - string, required on export / warning on import, default value "";

#### Accepted field names on import:

- All fields on ic:Address object will be accept with or without the ic: prefix

**Note:** All numbers should be represented as strings.
