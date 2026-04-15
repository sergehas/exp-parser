# development activities reporting tool

> Requirements: **Node >= 16**

## install

```powershell
npm i

# First run ?
#optional, can be also provided as arg
$env:MDR_GH_TOKEN="github_token"
$env:MDR_SQ_TOKEN="SonarQube_token"
#optional
$env:MDR_LOGGER_LEVEL="trace"
```

## Run

inline documentation is available from cli :

```powershell
npx  ts-node .\src\main.ts -h
npx  ts-node .\src\main.ts sq -h
npx  ts-node .\src\main.ts gh -h
npx  ts-node .\src\main.ts gh a -h
npx  ts-node .\src\main.ts gh b -h
```

### Sonarqube report

```powershell
# Another run ( you already have report.json )
# Here report_prev is just the path to the previous report.json to compare with the new report.json ( will be used to generate the report.md)

# Example you renamed report.json from last run into report_prev.json
npx ts-node .\src\main.ts -c .\prev_report.json
```

```powershell
npx -node-options=--no-warnings ts-node .\src\main.ts sq -r json -r mds -r csv  -r xslx -p 'DevEntity-HRTD-DDCE-EXT-HERMES-Cell-DVCCAPMVP' -p 'com.inetpsa.oms00:gui' -p 'com.inetpsa.sc400:gui' -vvv

 # shorten alternative
npx -node-options=--no-warnings ts-node .\src\main.ts sq -r json mds csv xlsx -p 'DevEntity-HRTD-DDCE-EXT-HERMES-Cell-DVCCAPMVP' 'com.inetpsa.oms00:gui' 'com.inetpsa.sc400:gui' -vvvv -c "reports/report-2023-10-19T12_05_43.619Z.json"
```

### Github reports

```powershell
npx ts-node .\src\main.ts gh b -o cay00 -r json
```

```powershell
npx -node-options=--no-warnings ts-node .\src\main.ts gh b -r json -r csv -o gcs00 -o cay00 -vvv -f reports-test

 # shorten alternative
npx -node-options=--no-warnings ts-node .\src\main.ts gh b -r json csv -o gcs00 cay00 -vvv -f reports-test
```

## Debug in VS code

use the provided conf in [`launch.json`](.vscode/launch.json)
`launch.json` :

## TODO

### GH report

replace multiple ReST API call for pull request & checks by a single graphQL request (not applicable to commit :/):

```graphql
# get PR with SonarQube checks
query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    pullRequests(last: 20) {
      nodes {
        id
        number
        title
        createdAt
        url
        author {
          login
        }
        headRefName
        baseRefName
        state
        isDraft
        merged
        mergedBy {
          login
        }
        additions
        deletions
        files {
          totalCount
        }
        commits(last: 1) {
          nodes {
            commit {
              checkSuites(
                filterBy: { appId: 11 } #appId=databaseId
                last: 10
              ) {
                nodes {
                  url
                  app {
                    # databaseId  : 11
                    name #"name": "SonarQubePRChecks"
                  }
                  status
                  conclusion
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## features

- [ ] enhance gh activity report
  - [ ] add xlsx report
  - [ ] add 'who's who': use git `.mailmap` ?
- [ ] enhance sq report by adding executive report (only high level view); , eventually using metric history. Relevant api are

> warning: `releasability_rating` do not apply to project (organization ), not to modules (aka. code projects)

```text
https://<host>/api/metrics/search

https://<host>/api/measures/component?component=DevProjects-GCS00&metricKeys=releasability_rating,sqale_rating,reliability_rating,security_rating,coverage,security_review_rating




https://<host>/api/measures/search_history?component=DevProjects-GCS00&metrics=alert_status,reliability_rating,security_rating,security_review_rating,sqale_rating,coverage
```

- [x] enhance sq xlsx report with conditional formatting : add

  ```javascript
    {
      ref: 'L1:Lxxx',
      rules: [
        {
          type: 'iconSet',
          priority: 1,
          iconSet: '4TrafficLights',
          reverse: true,
          cfvo: [
            { type: 'num', value: 0 },
            { type: 'num', value: 10 },
            { type: 'num', value: 30 },
            { type: 'num', value: 100 }
          ]
        }
      ]
    }
  ```

### others

- [ ] fix lint issue (usage of `any`)
