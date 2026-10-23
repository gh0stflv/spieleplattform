from dataclasses import dataclass

from werkzeug.security import check_password_hash


@dataclass
class Benutzer:
    id: int
    name: str
    email: str | None
    passwort_hash: str
    erstellt_am: str

    @classmethod
    def aus_zeile(cls, zeile):
        return cls(**dict(zeile))

    def pruefe_passwort(self, passwort: str) -> bool:
        return check_password_hash(self.passwort_hash, passwort)

    def als_dict(self):
        return {"id": self.id, "name": self.name, "erstellt_am": self.erstellt_am}
