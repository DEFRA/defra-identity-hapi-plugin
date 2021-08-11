pipeline {
    agent { label 'docker' }
    options {
        ansiColor('xterm')
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '5'))
        timeout(time: 1, unit: 'HOURS')
    }
    post {
        always {
            step([$class: 'WsCleanup'])
        }
    }
    stages {
        stage('Sonarqube') {
            steps {
                script {
                    sh(label: 'SonarScan wGet', script: 'wget -nv https://apsvssinfsto001.blob.core.windows.net/component-live-executables/SonarQubeJunitQGGitHubNixClient; chmod 555 ./SonarQubeJunitQGGitHubNixClient')
                    if ("$BRANCH_NAME" == 'master') {
                        sonarOpts = "sonar.branch.name=$BRANCH_NAME;"
                    }
                    else {
                        sonarOpts = "sonar.branch.name=$BRANCH_NAME;sonar.branch.target=master"
                    }
                    withEnv(["SONAROPTIONS=${sonarOpts}"]) {
                        if (sh(label: 'SonarScan run', script: './SonarQubeJunitQGGitHubNixClient "https://github.com/DEFRA/defra-identity-hapi-plugin.git" "$BRANCH_NAME" "$SONAROPTIONS" "runJunit.sh"', returnStatus: true) != 0) {
                            error('sonarscan failed')
                        }
                    }
                }
            }
        }
    }
}
