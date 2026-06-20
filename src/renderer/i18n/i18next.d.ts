import 'i18next'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    enableSelector: true
    resources: {
      translation: {
        activityBar: {
          connections: string
          transfers: string
        }
        app: {
          name: string
          subtitle: string
        }
        common: {
          action: {
            cancel: string
            close: string
            confirm: string
            create: string
            delete: string
            refresh: string
          }
          close: string
          selectPlaceholder: string
          sort: {
            asc: string
            desc: string
          }
        }
        confirmationDialog: {
          confirmDeleteMessage: string
          confirmDeleteMultipleMessage_one: string
          confirmDeleteMultipleMessage_other: string
          confirmDeleteMultipleTitle: string
          confirmDeleteTitle: string
          deleteConnectionMessage: string
          deleteConnectionTitle: string
        }
        conflict: {
          applyToAll: string
          cannotOverwrite: string
          globalAction: string
          keepBoth: string
          overwrite: string
          skip: string
          source: string
          target: string
          title: string
        }
        connection: {
          connect: string
          connections: string
          disconnect: string
          edit: string
          moreActions: string
          newConnection: string
          newConnectionHint: string
          noConnections: string
        }
        connectionDialog: {
          basePath: string
          basePathPlaceholder: string
          certWarningMessage: string
          certWarningTitle: string
          connectFailed: string
          connecting: string
          continue: string
          decryptFailed: string
          editTitle: string
          encryptFailed: string
          fillRequired: string
          host: string
          hostPlaceholder: string
          invalidPort: string
          name: string
          namePlaceholder: string
          password: string
          passwordPlaceholder: string
          port: string
          protocol: string
          protocolSftp: string
          protocolWebdav: string
          rejectUnauthorized: string
          save: string
          savePassword: string
          scheme: string
          schemeHttp: string
          schemeHttps: string
          subtitle: string
          username: string
          usernamePlaceholder: string
        }
        error: {
          listDirectoryFailed: string
          noOperationPending: string
          unknown: string
          unknownName: string
          unknownProtocol: string
        }
        file: {
          action: {
            copy: string
            download: string
            move: string
            newFolder: string
            properties: string
            rename: string
            upload: string
            uploadFiles: string
            uploadFolder: string
          }
          dropToUpload: string
        }
        fileExplorerList: {
          dateModified: string
          disconnected: string
          empty: string
          error: string
          loading: string
          name: string
          owner: string
          parentDirectory: string
          permissions: string
          reconnectHint: string
          retry: string
          size: string
        }
        folderProperties: {
          calculate: string
          calculating: string
          cancelCalculation: string
          cancelled: string
          completed: string
          errorCount_one: string
          errorCount_other: string
          failed: string
          fileCount: string
          folderCount: string
          modifyTime: string
          owner: string
          permissions: string
          recalculate: string
          scanning: string
          size: string
        }
        hostKey: {
          currentHash: string
          disconnect: string
          firstConnectTitle: string
          firstConnectWarning: string
          mismatchTitle: string
          mismatchWarning: string
          previousHash: string
          trustAndSave: string
          trustNew: string
        }
        language: {
          chinese: string
          english: string
          enShort: string
          zhShort: string
        }
        mainLayout: {
          darkMode: string
          lightMode: string
          system: string
        }
        passwordInput: {
          hidePassword: string
          showPassword: string
        }
        sortButton: {
          sortConnections: string
        }
        targetFolderDialog: {
          title: string
        }
        textInputDialog: {
          folderNamePlaceholder: string
          newFolderPlaceholder: string
          newNamePlaceholder: string
        }
        titleBar: {
          close: string
          dragToMove: string
          maximize: string
          minimize: string
          restore: string
        }
        toast: {
          cannotCopyToSelf: string
          cannotMoveToSelf: string
          connectionFailed: string
          connectionLost: string
          connectionSuccess: string
          copyFailed: string
          copySuccess: string
          createFolderFailed: string
          createFolderSuccess: string
          deleteConnectionSuccess: string
          deleteFailed: string
          deleteSuccess: string
          disconnectFailed: string
          disconnectSuccess: string
          downloadDuplicates_one: string
          downloadDuplicates_other: string
          downloadFailed: string
          moveFailed: string
          moveSuccess: string
          refreshFailed: string
          renameFailed: string
          renameSuccess: string
          uploadDuplicates_one: string
          uploadDuplicates_other: string
          uploadFailed: string
        }
        transfer: {
          action: {
            cancel: string
            cancelAll: string
            remove: string
            retry: string
            sort: string
            viewErrorDetails: string
          }
          concurrency: {
            download: string
            upload: string
          }
          confirmDisconnect: {
            message: string
            title: string
          }
          confirmQuit: {
            message: string
            title: string
          }
          download: string
          empty: string
          errorDetail: {
            copied: string
            copy: string
            title: string
          }
          folderStats: {
            fileCount: string
          }
          path: {
            destination: string
            source: string
          }
          runningCount_one: string
          runningCount_other: string
          sort: {
            name: string
            size: string
            status: string
            time: string
          }
          status: {
            failed: string
            failedCount_one: string
            failedCount_other: string
            running: string
            waiting: string
          }
          upload: string
        }
      }
    }
  }
}
