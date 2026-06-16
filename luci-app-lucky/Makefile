include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI for lucky
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-lucky
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_PO_VERSION:=$(PKG_VERSION)

LUCI_MINIFY_JS:=0
LUCI_MINIFY_CSS:=0

include $(TOPDIR)/feeds/luci/luci.mk

define Package/$(PKG_NAME)/conffiles
/etc/config/lucky
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
INITD=/etc/init.d
$${INITD}/lucky enable
(sleep 3
 $${INITD}/rpcd restart
 [ -x $${INITD}/uhttpd ] && $${INITD}/uhttpd restart
 [ -x $${INITD}/nginx  ] && $${INITD}/nginx   restart
 $${INITD}/lucky start
) > /dev/null 2>&1 &

exit 0
endef

define Package/$(PKG_NAME)/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
INITD=/etc/init.d
$${INITD}/lucky stop    2>/dev/null || true
$${INITD}/lucky disable 2>/dev/null || true
ubus call service delete '{"name":"lucky"}' 2>/dev/null || true
(sleep 2
 $${INITD}/rpcd restart
 [ -x $${INITD}/uhttpd ] && $${INITD}/uhttpd restart
 [ -x $${INITD}/nginx  ] && $${INITD}/nginx   restart
) > /dev/null 2>&1 &

exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
