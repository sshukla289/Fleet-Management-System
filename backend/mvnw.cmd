@ECHO OFF
SETLOCAL EnableDelayedExpansion

SET "MAVEN_PROJECTBASEDIR=%~dp0"
IF "%MAVEN_PROJECTBASEDIR:~-1%"=="\" SET "MAVEN_PROJECTBASEDIR=%MAVEN_PROJECTBASEDIR:~0,-1%"

SET "WRAPPER_DIR=%MAVEN_PROJECTBASEDIR%\.mvn\wrapper"
SET "WRAPPER_PROPERTIES=%WRAPPER_DIR%\maven-wrapper.properties"
SET "WRAPPER_JAR=%WRAPPER_DIR%\maven-wrapper.jar"
SET "WRAPPER_URL=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.4/maven-wrapper-3.3.4.jar"

IF NOT EXIST "%WRAPPER_PROPERTIES%" (
  ECHO wrapperUrl is missing from "%WRAPPER_PROPERTIES%"
  EXIT /B 1
)

IF NOT EXIST "%WRAPPER_JAR%" (
  ECHO Downloading Maven wrapper from !WRAPPER_URL!
  "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; $url='!WRAPPER_URL!'; $dest='!WRAPPER_JAR!'; New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($dest)) | Out-Null; Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $dest"
  IF ERRORLEVEL 1 EXIT /B 1
)

IF "%JAVA_HOME%"=="" (
  SET "JAVA_EXE=java"
) ELSE IF EXIST "%JAVA_HOME%\bin\java.exe" (
  SET "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
) ELSE IF EXIST "%JAVA_HOME%\java.exe" (
  SET "JAVA_EXE=%JAVA_HOME%\java.exe"
) ELSE (
  SET "JAVA_EXE=java"
)

"%JAVA_EXE%" "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" -classpath "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
EXIT /B %ERRORLEVEL%
