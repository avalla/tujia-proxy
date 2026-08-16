Java.perform(function () {
    console.log("[*] SSL Pinning bypass started");

    // Bypass 1: TrustManagerImpl (OkHttp / Android)
    try {
        var TrustManagerImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl');
        TrustManagerImpl.checkTrustedRecursive.implementation = function () {
            console.log("[+] TrustManagerImpl.checkTrustedRecursive bypassed");
            return Java.use("java.util.ArrayList").$new();
        };
    } catch (e) {
        console.log("[-] TrustManagerImpl not found");
    }

    // Bypass 2: OkHostnameVerifier
    try {
        var OkHostnameVerifier = Java.use('okhttp3.internal.tls.OkHostnameVerifier');
        OkHostnameVerifier.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function () {
            console.log("[+] OkHostnameVerifier.verify bypassed");
            return true;
        };
    } catch (e) {
        console.log("[-] OkHostnameVerifier not found");
    }

    // Bypass 3: X509TrustManager (generico)
    try {
        var X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
        var SSLContext = Java.use('javax.net.ssl.SSLContext');
        
        var TrustManager = Java.registerClass({
            name: 'com.example.TrustManager',
            implements: [X509TrustManager],
            methods: {
                checkClientTrusted: function () {},
                checkServerTrusted: function () {},
                getAcceptedIssuers: function () { return []; }
            }
        });

        var TrustManagers = [TrustManager.$new()];
        var SSLContext_init = SSLContext.init.overload(
            '[Ljavax.net.ssl.KeyManager;', 
            '[Ljavax.net.ssl.TrustManager;', 
            'java.security.SecureRandom'
        );
        
        SSLContext_init.implementation = function (keyManager, trustManager, secureRandom) {
            console.log("[+] SSLContext.init() hooked");
            SSLContext_init.call(this, keyManager, TrustManagers, secureRandom);
        };
    } catch (e) {
        console.log("[-] X509TrustManager bypass failed: " + e);
    }

    // Bypass 4: WebView SSL
    try {
        var WebView = Java.use('android.webkit.WebView');
        var SslErrorHandler = Java.use('android.webkit.SslErrorHandler');
        WebView.setWebViewClient.implementation = function (client) {
            console.log("[+] WebView client hooked");
            return this.setWebViewClient(client);
        };
    } catch (e) {
        console.log("[-] WebView bypass failed");
    }

    console.log("[*] SSL Pinning bypass active");
});
