# Prompt 009

## Metadata

- Prompt ID: prompt-20260916191648-f5ff97
- Conversation ID: conv-20260916162628-2imp
- Timestamp: 2026-09-16T18:16:48.030Z
- Sequence Number: 9
- Source URL: https://m365.cloud.microsoft/chat/conversation/6ebae526-f9e8-45bf-9af3-dff9279d7bae

## Prompt

github hang,​‌This confirms the schema, and since FAO code comparisons are case-insensitive for duplicate detection, I'll apply the same case-insensitive treatment to the exact FAO code filter, matching the repo convention where vessel identifiers, gear codes, category codes, and FAO species codes are all case-insensitive.For the remaining ambiguities, I'll go with exact matching for FAO codes since that's consistent with how gear and port code exact filters work. For scientific name, since there's no established convention specifying partial vs exact matching, I'll implement it as an exact, case-insensitive filter too—keeping it consistent with how all other exactFilters have behaved in prior steps—while relying on the general free-text search field to cover partial matching needs for users who want that.For country-code and language-code filters, since they require searching nested arrays rather than a simple field lookup, I'll implement them as customFilters with predicates that check whether any commonNames or localNames entry matches the given code, using case-insensitive comparison since both country and language codes are often written inconsistently in casing. Now I'm working through how to handle general text search across faoCode, scientificName, and the​‌Reasining​‌is trying to optimised the schma , idoes no need , it need to stick the apis definition ​‌
