#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>
#include <wchar.h>

static int fail(const wchar_t *message, DWORD error) {
    wchar_t buffer[512];
    DWORD written = 0;
    _snwprintf(buffer, sizeof(buffer) / sizeof(buffer[0]),
        L"NFSU2 native host launcher: %ls (Windows error %lu)\n",
        message, error);
    WriteFile(GetStdHandle(STD_ERROR_HANDLE), buffer,
        (DWORD)(wcslen(buffer) * sizeof(wchar_t)), &written, NULL);
    return (int)error;
}

static void close_standard_handles(HANDLE input, HANDLE output, HANDLE error) {
    HANDLE handles[] = { input, output, error };
    for (unsigned int i = 0; i < sizeof(handles) / sizeof(handles[0]); ++i) {
        if (handles[i] == NULL || handles[i] == INVALID_HANDLE_VALUE) continue;
        BOOL alreadyClosed = FALSE;
        for (unsigned int j = 0; j < i; ++j) {
            if (handles[i] == handles[j]) {
                alreadyClosed = TRUE;
                break;
            }
        }
        if (!alreadyClosed) CloseHandle(handles[i]);
    }
}

int main(void) {
    wchar_t modulePath[MAX_PATH];
    DWORD moduleLength = GetModuleFileNameW(NULL, modulePath, MAX_PATH);
    if (moduleLength == 0 || moduleLength >= MAX_PATH) {
        return fail(L"could not locate launcher executable", GetLastError());
    }

    wchar_t *lastSlash = wcsrchr(modulePath, L'\\');
    if (lastSlash == NULL) {
        return fail(L"launcher path has no directory", ERROR_BAD_PATHNAME);
    }
    lastSlash[1] = L'\0';

    wchar_t nodePathFile[MAX_PATH];
    wchar_t scriptPath[MAX_PATH];
    if (_snwprintf(nodePathFile, MAX_PATH, L"%lsnode-path.txt", modulePath) < 0 ||
        _snwprintf(scriptPath, MAX_PATH, L"%lshost.js", modulePath) < 0) {
        return fail(L"companion path is too long", ERROR_FILENAME_EXCED_RANGE);
    }

    HANDLE nodePathHandle = CreateFileW(nodePathFile, GENERIC_READ, FILE_SHARE_READ,
        NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (nodePathHandle == INVALID_HANDLE_VALUE) {
        return fail(L"could not open node-path.txt", GetLastError());
    }

    char nodePathUtf8[MAX_PATH * 4];
    DWORD bytesRead = 0;
    BOOL readOk = ReadFile(nodePathHandle, nodePathUtf8,
        sizeof(nodePathUtf8) - 1, &bytesRead, NULL);
    CloseHandle(nodePathHandle);
    if (!readOk || bytesRead == 0) {
        return fail(L"node-path.txt is empty or unreadable", GetLastError());
    }
    nodePathUtf8[bytesRead] = '\0';

    wchar_t nodePath[MAX_PATH];
    int nodePathLength = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS,
        nodePathUtf8, -1, nodePath, MAX_PATH);
    if (nodePathLength == 0) {
        return fail(L"node-path.txt is not valid UTF-8", GetLastError());
    }

    wchar_t commandLine[MAX_PATH * 3];
    int commandLength = _snwprintf(commandLine, MAX_PATH * 3,
        L"\"%ls\" \"%ls\"", nodePath, scriptPath);
    if (commandLength < 0 || commandLength >= MAX_PATH * 3) {
        return fail(L"Node command line is too long", ERROR_FILENAME_EXCED_RANGE);
    }

    STARTUPINFOW startupInfo = {0};
    startupInfo.cb = sizeof(startupInfo);
    startupInfo.dwFlags = STARTF_USESTDHANDLES;
    startupInfo.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    startupInfo.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
    startupInfo.hStdError = GetStdHandle(STD_ERROR_HANDLE);
    PROCESS_INFORMATION processInfo = {0};

    if (!CreateProcessW(nodePath, commandLine, NULL, NULL, TRUE,
        CREATE_NO_WINDOW, NULL, modulePath, &startupInfo, &processInfo)) {
        return fail(L"could not start Node.js", GetLastError());
    }

    close_standard_handles(startupInfo.hStdInput, startupInfo.hStdOutput,
        startupInfo.hStdError);
    CloseHandle(processInfo.hThread);
    WaitForSingleObject(processInfo.hProcess, INFINITE);
    DWORD exitCode = 1;
    GetExitCodeProcess(processInfo.hProcess, &exitCode);
    CloseHandle(processInfo.hProcess);
    return (int)exitCode;
}
