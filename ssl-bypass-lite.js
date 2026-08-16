Java.perform(function () {
    console.log("[*] Lite bypass started");

    try {
        var TrustManagerImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl');
        TrustManagerImpl.checkTrustedRecursive.implementation = function () {
            console.log("[+] TrustManagerImpl bypassed");
            return Java.use("java.util.ArrayList").$new();
        };
    } catch (e) {
        console.log("[-] TrustManagerImpl: " + e);
    }

    try {
        var OkHostnameVerifier = Java.use('okhttp3.internal.tls.OkHostnameVerifier');
        OkHostnameVerifier.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function () {
            console.log("[+] OkHostnameVerifier bypassed");
            return true;
        };
    } catch (e) {
        console.log("[-] OkHostnameVerifier: " + e);
    }

    try {
        var TrustManager = Java.use('javax.net.ssl.X509TrustManager');
        var SSLContext = Java.use('javax.net.ssl.SSLContext');
        var TrustManagerImplCustom = Java.registerClass({
            name: 'com.bypass.TrustManager',
            implements: [TrustManager],
            methods: {
                checkClientTrusted: function () {},
                checkServerTrusted: function () {},
                getAcceptedIssuers: function () { return []; }
            }
        });
        var ctx = SSLContext.getInstance("TLS");
        ctx.init(null, [TrustManagerImplCustom.$new()], null);
        console.log("[+] Custom TrustManager injected");
    } catch (e) {
        console.log("[-] Custom TrustManager: " + e);
    }

    console.log("[*] Lite bypass active");
});
