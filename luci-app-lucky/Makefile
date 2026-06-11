include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI for lucky
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-lucky
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

LUCI_MINIFY_JS:=0
LUCI_MINIFY_CSS:=0

include $(TOPDIR)/feeds/luci/luci.mk

define Package/$(PKG_NAME)/conffiles
/etc/config/lucky
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
INITD=/etc/init.d/lucky
[ "$$(uci -q get lucky.lucky.arch)" = "auto" ] && {
    uci set lucky.lucky.arch="$$(uname -m)"
    uci commit lucky
}
$$INITD enable 2>/dev/null || true
(
    sleep 3
    /etc/init.d/rpcd restart  2>/dev/null || true
    [ -x /etc/init.d/uhttpd ] && /etc/init.d/uhttpd restart 2>/dev/null || true
    [ -x /etc/init.d/nginx  ] && /etc/init.d/nginx  restart 2>/dev/null || true
    $$INITD start 2>/dev/null || true
) > /dev/null 2>&1 &
exit 0
endef

define Package/$(PKG_NAME)/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
INITD=/etc/init.d/lucky
$$INITD stop    2>/dev/null || true
$$INITD disable 2>/dev/null || true
ubus call service delete '{"name":"lucky"}' 2>/dev/null || true
(
    sleep 2
    /etc/init.d/rpcd restart  2>/dev/null || true
    [ -x /etc/init.d/uhttpd ] && /etc/init.d/uhttpd restart 2>/dev/null || true
    [ -x /etc/init.d/nginx  ] && /etc/init.d/nginx  restart 2>/dev/null || true
) > /dev/null 2>&1 &

exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
