import {Platform} from 'react-native'
import ModelManager from "./modelManager";
import Sync from "./syncManager";
import { SFPrivilegesManager, SFSingletonManager } from "snjs";
import AuthenticationSourceAccountPassword from "@Screens/Authentication/Sources/AuthenticationSourceAccountPassword";
import AuthenticationSourceLocalPasscode from "@Screens/Authentication/Sources/AuthenticationSourceLocalPasscode";
import AuthenticationSourceBiometric from "@Screens/Authentication/Sources/AuthenticationSourceBiometric";
import KeyManager from "@Lib/snjs/keyManager"
import Storage from "@SNJS/storageManager"
import Auth from "@SNJS/authManager"
import StyleKit from "@Style/StyleKit"

export default class PrivilegesManager extends SFPrivilegesManager {

  static instance = null;

  static get() {
    if (this.instance == null) {
      let singletonManager = new SFSingletonManager(ModelManager.get(), Sync.get());
      this.instance = new PrivilegesManager(ModelManager.get(), Sync.get(), singletonManager);
    }

    return this.instance;
  }

  constructor(modelManager, syncManager, singletonManager) {
    super(modelManager, syncManager, singletonManager);

    this.setDelegate({
      isOffline: async () => {
        return Auth.get().offline();
      },
      hasLocalPasscode: async () => {
        let hasPasscode = KeyManager.get().hasOfflinePasscode();
        let hasBiometrics = KeyManager.get().hasBiometrics();
        return hasPasscode || hasBiometrics;
      },
      saveToStorage: async (key, value) => {
        return Storage.get().setItem(key, value);
      },
      getFromStorage: async (key) => {
        return Storage.get().getItem(key);
      }
    });
  }

  async presentPrivilegesModal(action, navigation, onSuccess, onCancel) {
    if(this.authenticationInProgress()) {
      onCancel && onCancel();
      return;
    }

    let customSuccess = () => {
      onSuccess && onSuccess();
      this.authInProgress = false;
    }

    let customCancel = () => {
      onCancel && onCancel();
      this.authInProgress = false;
    }

    let sources = await this.sourcesForAction(action);

    let sessionLengthOptions = await this.getSessionLengthOptions();
    let selectedSessionLength = await this.getSelectedSessionLength();

    navigation.navigate("Authenticate", {
      leftButton: {
        title: Platform.OS == "ios" ? "Cancel" : null,
        iconName: Platform.OS == "ios" ? null : StyleKit.nameForIcon("close"),
      },
      authenticationSources: sources,
      hasCancelOption: true,
      sessionLengthOptions: sessionLengthOptions,
      selectedSessionLength: selectedSessionLength,
      onSuccess: (selectedSessionLength) => {
        this.setSessionLength(selectedSessionLength);
        customSuccess();
      },
      onCancel: () => {
        customCancel();
      }
    });

    this.authInProgress = true;
  }

  authenticationInProgress() {
    return this.authInProgress;
  }

  async sourcesForAction(action) {
    const sourcesForCredential = (credential) => {
      if(credential == SFPrivilegesManager.CredentialAccountPassword) {
        return [new AuthenticationSourceAccountPassword()];
      } else if(credential == SFPrivilegesManager.CredentialLocalPasscode) {
        var hasPasscode = KeyManager.get().hasOfflinePasscode();
        var hasBiometrics = KeyManager.get().hasBiometrics();
        let sources = [];
        if(hasPasscode) {sources.push(new AuthenticationSourceLocalPasscode());}
        if(hasBiometrics) {sources.push(new AuthenticationSourceBiometric());}
        return sources;
      }
    }

    let credentials = await this.netCredentialsForAction(action);
    let sources = [];
    for(var credential of credentials) {
      sources = sources.concat(sourcesForCredential(credential)).sort((a, b) => {
        return a.sort - b.sort;
      })
    }

    return sources;
  }

  async grossCredentialsForAction(action) {
    let privs = await this.getPrivileges();
    let creds = privs.getCredentialsForAction(action);
    return creds;
  }
}